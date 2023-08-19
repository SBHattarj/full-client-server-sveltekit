import ts from "typescript";
import { getTsconfig } from "get-tsconfig";
import path from "path"
import fs from "fs/promises"
import { callerInSet, getPropertyExpressionParent, isFunctionNode, isIdenntifierCallExpression, isModuleDefaultImport, isNodeDeclaration, isServerImport, isServerNPMImport } from "./utils.js";
/** @typedef {import("vite").UserConfig} UserConfig */
/** @typedef {import("./ws-events").WebSocketLike} WebSocketLike */

const fullClientServerImport = "full-client-server-sveltekit"
const globalsConst = new Set(["console"])

const imports = `import WSEvents from "${fullClientServerImport}/ws-events";
import { serialize, deserialize } from "${fullClientServerImport}";
/** @typedef {import("${fullClientServerImport}").CacheData} CacheData */
/** @typedef {import("${fullClientServerImport}/ws-events").WebSocketServerLike} WebSocketServer */
/** @typedef {import("${fullClientServerImport}/ws-events").WebSocketLike} WebSocket */


/**
* @param {(wse: import("${fullClientServerImport}/ws-events").WSEventHandler) => any} cb
* @param {(wss: WebSocketServer, ws: WebSocket) => boolean} [validator]
* @param {(cache: CacheData, wss: WebSocketServer, ws: WebSocket) => void} [dispose]
* @return {(wse: WebSocketServer) => void}
*/`

/**
 * @param {string} s
 */
function createUpdateBlock(s) {
    const varIdentifier = ts.factory.createIdentifier(s)
    const updateIdentifier = ts.factory.createIdentifier(`${s}Updated`)
    const updateAssignment = ts.factory.createAssignment(
        varIdentifier,
        updateIdentifier
    )
    const ifBlock = ts.factory.createIfStatement(
        ts.factory.createStrictInequality(
            varIdentifier,
            updateIdentifier
        ),
        ts.factory.createBlock([
            ts.factory.createExpressionStatement(updateAssignment)
        ])
    )
    const tryBlock = ts.factory.createTryStatement(
        ts.factory.createBlock([
            ifBlock
        ]),
        ts.factory.createCatchClause(
            undefined,
            ts.factory.createBlock([])
        ),
        undefined

    )
    return tryBlock
}

/**
 * @typedef {{
        locals: Set<string>,
        function: string,
        id: string,
        sharedServer?: Set<{name: string, propertyName: string, exporter: string}>
    }} callNodeCallType
 */
/**
 * @param {Map<string, callNodeCallType>} callNodeCalls
 */
function createServerImport(callNodeCalls) {
    /** @type {Set<string>} */
    let wsCalls = new Set()
    for(let [key, value] of callNodeCalls) {
        let idString = "id"
        let updateString = "update"
        let callerString = "caller"
        let sharedServer = value.sharedServer ?? new Set()
        /** @type {Map<string, {name: string, propertyName: string}[]>} */
        let imports = new Map()
        /** @type {Set<string>} */
        let importedVars = new Set()
        for(let {name, propertyName, exporter} of sharedServer) {
            importedVars.add(name)
            if(imports.get(exporter) == null) {
                imports.set(exporter, [])
            }
            imports.get(exporter)?.push({
                name,
                propertyName
            })
        }
        let importsString = ''
        for (let [exporter, properties] of imports) {
            importsString += `\n                const { ${
                properties.map(({name, propertyName}) => `${propertyName}: ${name}`).join(", ")
            } } = await import("${exporter}");`
        }
        while(value.locals.has(idString) || importedVars.has(idString)) {
            idString = `${idString}1`
        }
        while(value.locals.has(updateString) || importedVars.has(updateString)) {
            updateString = `${updateString}1`
        }
        while(value.locals.has(callerString) || importedVars.has(callerString)) {
            callerString = `${callerString}1`
        }
        wsCalls.add(`
            wsEvents.on("${key}", /** 
            * @this CacheData
            * @param {string} str
            */ async function (str) {
                if(this.cache == null) return
                if(this.functionMap == null) return
                if(this.functionRef == null) return
                if(this.weakRef == null) return
                let [${[idString, ...value.locals,  updateString].join(", ")}] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache,
                    this.functionMap,
                    this.functionRef,
                    this.weakRef
                );${importsString}
                // @ts-ignore
                let ${callerString} = ${
                    value.function.replace(
                        /import\((["'`])(\.\.?)/g, 
                        (_, quote, prefix) => {
                            const newPrefix = path.resolve(
                                value.id.replace(/\/[^\/]*$/, ""),
                                prefix
                            )
                            return `import(${quote}${newPrefix}`
                        }
                    ).split("\n").map(
                    (line, index) => index == 0 ? line : 
`// @ts-ignore
                ${line}`
                    ).join("\n")
                }

                const result = await caller();
                ${updateString}(${[...value.locals].join(", ")});
                wsEvents.emit(\`${key}-$\{${idString}}\`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache,
                    this.functionRef,
                    this.functionMap,
                    this.weakRef
                ));
            }.bind(data));
        `)
    }
    const wssConnectionBlock = `
            const wsEvents = WSEvents(ws);
            ${[...wsCalls].join("\n")}
            cb(wsEvents);
    `
    const returnHandlerFunction = `function handleWse(wss) {
        wss.on("connection", ws => {
            if(validator != null && !validator?.(wss, ws)) return
            /** @type {CacheData} */
            let data = {
                cache: {},
                functionRef: new Map(),
                functionMap: new Map(),
                weakRef: new WeakMap()
            }
            ws.onclose = function () {
                if(dispose != null) {
                    dispose(data, wss, ws)
                    return
                }
                delete data.cache
                delete data.functionRef
                delete data.functionMap
                delete data.weakRef
            }
            ${wssConnectionBlock}
        })
    }
    `
    const defaultExportStatement = `export default function handleWs(cb, validator, dispose) {
    return ${returnHandlerFunction}
};
`
    
    return `${imports}\n${defaultExportStatement}`
}

const browserWSConfigNotFoundID =  "__internal_full_client_server_missing_config__"

export function serverBrowserSync(
    {
        cwd = process.cwd(),
        browserWSConfig = "src/browserWS.config",
        wsOutput = "src/lib/ws",
        configExtensions = [".js", ".ts"],
        /**
         * @type {boolean}
         * @description Whether the module is being internally developed should only be true if using to build the module
         */
        __internal_is_dev_module__ = false
    } = {}
) {
    /** @type {Map<string, callNodeCallType>}*/
    const callNodeCalls = new Map();
    /**
     * @type {Map<string, {
        defaultImport?: string,
        namedImports: {
            name: string,
            propertyName: string
        }[]
        
      }>}
     */
    const serverImportMap = new Map();
    return [
        {
            name: 'transform-svelte-tsconfig',
            /** @type {"pre"} */
            enforce: /** @type {const} */"pre",
            async configResolved() {
                let svelteTSConfig = getTsconfig(path.resolve(process.cwd(), ".svelte-kit"))
                if(svelteTSConfig != null) {
                    if(svelteTSConfig.config.compilerOptions?.paths != null) {
                        svelteTSConfig.config.compilerOptions.paths["server:"] = ["../src"]
                        svelteTSConfig.config.compilerOptions.paths["server:/*"] = ["../src/*"]
                        svelteTSConfig.config.compilerOptions.paths["server:npm:*"] = [
                            "../node_modules/*",
                            "../node_modules/@types/*"
                        ]
                        delete svelteTSConfig.config.compilerOptions.paths["server:npm:*/*"]
                        if(svelteTSConfig?.config == null) return
                        setTimeout(async () => {
                            await fs.writeFile(
                                path.resolve(process.cwd(), ".svelte-kit", "tsconfig.json"),
                                JSON.stringify(
                                    svelteTSConfig?.config,
                                    undefined,
                                    4
                                ),
                            )
                        }, 300)
                    }
                }
            },
        },
        {
            name: 'transform-client-server-node',
            /**
             * @param {UserConfig} _
             * @param {Object} options
             * @param {string} options.command
             */
            async config(_, {command}) {
                if(command === "build" && !__internal_is_dev_module__) return {
                    define: {
                        "import.meta.env.__internal_full_client_server_cwd__": `"${cwd}"`,
                        "import.meta.env.__internal_full_client_server_import__": `"${browserWSConfig}"`
                    }
                }
                if(command === "build") return
                await fs.writeFile(path.resolve(cwd, `${wsOutput}.js`), `
${imports}
export default (function handleWs(cb, validator, dispose) {
    return function handleWse(wss) {
        wss.on("connection", ws => {
            if(validator != null && !validator?.(wss, ws)) return
            /** @type {CacheData} */
            const data = {
                cache: {},
                funcMap: new Map(),
                funcRef: new Map(),
                weakRef: new WeakMap()
            }
            ws.onclose = function () {
                if(dispose != null) {
                    dispose(data, wss, ws)
                    return
                }
                delete data.cache
                delete data.funcMap
                delete data.funcRef
                delete data.weakRef
            }
            const wsEvents = WSEvents(ws);
            cb(wsEvents);
        });
    };
});
`)
                return {
                    define: {
                        "import.meta.env.__internal_full_client_server_cwd__": `"${cwd}"`,
                        "import.meta.env.__internal_full_client_server_import__": `"${browserWSConfig}"`
                    }
                }
                
            },
            /**
             * @param {string} id
             * @param {string | undefined} _
             * @param {Object} options
             * @param {boolean} [options.ssr]
             */
            async resolveId(id, _, {ssr}) {
                let browserWSConfigPath = `${cwd}/${browserWSConfig}`
                let possibleBrowserWSConfigFiles = configExtensions.map(ext => `${browserWSConfigPath}${ext}`)
                if(id === browserWSConfigPath) {
                    let files = await fs.readdir(browserWSConfigPath.replace(/\/[^\/]*$/, ""))
                    
                    let configFile = files.find(file => file in possibleBrowserWSConfigFiles)
                    if(configFile == null) return browserWSConfigNotFoundID
                    return configFile
                }
                /*if(![...files].includes(browserWSConfig.replace(/^.*\//g, ""))) {
                    return browserWSConfigNotFoundID
                }*/
                if(ssr && id.startsWith("server:npm:")) {
                    return
                }
                if(ssr && id.startsWith("server:")) {
                    const serverId = id.replace(/^server\:/, "")
                    return path.resolve(process.cwd(), `./src${serverId}`)
                }
                if(serverImportMap.has(id)) return id
            },
            /**
             * @param {string} id
             */
            load(id) {
                if(id === browserWSConfigNotFoundID) {
                    return ""
                }
                if(serverImportMap.has(id)) {
                    /** @type {{defaultImport?: string, namedImports?: {name: string, propertyName: string}[]}} */
                    const {defaultImport, namedImports = []} = serverImportMap.get(id) ?? {}
                    let allExportsName = "allExports"
                    for(let {propertyName} of namedImports) {
                        if(propertyName === allExportsName) allExportsName += "1"
                    }
                    const exportsDeclarations = namedImports.map(({propertyName}) => {
                    return `export const ${propertyName} = ${allExportsName}.${propertyName};`
                    }).join(";\n")
                    return `
import { callNode } from "${fullClientServerImport}";
const ${allExportsName} = await callNode("${id}", [], () => {});
${defaultImport != null ? `export default ${allExportsName}.default;` : ""}
${exportsDeclarations}
`
                }
            },

            /**
             * @param {string} code
             * @param {string} id
             * @param {Object} [options]
             * @param {boolean} [options.ssr]
             */
            async transform(code, id, options) {
                const fileServerImportMap = new Map()
                if(!code.includes("full-client-server-sveltekit") && !code.includes("server:")) return
                if(options?.ssr) {
                    const printer = ts.createPrinter()
                    /** @type {Map<string, string>} */
                    const importsMap = new Map()
                    let ast = ts.createSourceFile(
                        id,
                        code,
                        ts.ScriptTarget.Latest,
                        true
                    )
                    for(let child of ast.statements) {

                        if(ts.isImportDeclaration(child)) {
                            const importSrc = child.moduleSpecifier.getText()
                            if(importSrc.startsWith("'server:npm:") || importSrc.startsWith('"server:npm:')) {
                                importsMap.set(child.getText(), child.getText().replace("server:", "").replace("npm:", ""))
                            }
                        }
                    }
                    let newCode = printer.printNode(ts.EmitHint.Unspecified, ast, ast)
                    for(let [key, replacer] of importsMap) {
                        newCode = newCode.replace(key, replacer)
                    }
                    return newCode
                }
                let isChanged = false
                let ast = ts.createSourceFile(
                    id,
                    code,
                    ts.ScriptTarget.Latest,
                    true
                )
                /** @type {string | undefined} */
                let nodeCallIdentifier
                /** @type {Set<string>} */
                let serverVars = new Set()
                /** @type {Map<string, {propertyName: string, exporter: string}>} */
                let serverVarsProperty = new Map()
                const printer = ts.createPrinter()
                let nextId = 0
                
                /**
                 * @param {Object} options
                 * @param {ts.Node} options.ast
                 * @param {string} options.file
                 * @param {boolean} [options.isDeclaration]
                 * @param {boolean} [options.isBindingName]
                 * @param {boolean} [options.top]
                 * @param {Set<string>} [options.prevLocals]
                 * @param {boolean} [options.saveNonLocals]
                 * @param {boolean} [options.isServer]
                 */
                function codeTransformAST({
                    ast, 
                    isDeclaration = false, 
                    isBindingName = false,
                    file,
                    prevLocals = new Set(),
                    saveNonLocals = false,
                    isServer
                }) {
                    /** @type {Set<string>} */
                    const locals = new Set()
                    const nonLocals = new Set()
                    if(!isServer && isServerNPMImport(ast)) {
                        let defaultImport = ast.importClause?.name?.getText()
                        let namedImports = []
                        if(
                            "elements" in (ast.importClause?.namedBindings ?? {})
                        ) {
                            /** @type {any} */
                            let {elements = []} = ast.importClause?.namedBindings ?? {}
                            
                            for(let namedImport of elements) {
                                if(!("propertyName" in namedImport)) continue
                                if(!("name" in namedImport)) continue
                                let name = namedImport.name?.getText()
                                let propertyName = namedImport.propertyName?.getText() ?? name
                                namedImports.push({ propertyName, name })
                            }
                        }
                        const trueImportString = ast.moduleSpecifier
                            .getText()
                            .replace(/^["']server\:npm\:/, "")
                            .replace(/["']/g, "")

                        const importString = `__internal_full_client_server_import__${trueImportString}?=${
                            defaultImport ?? ""
                        },${namedImports.map(({propertyName, name}) => {
                            serverVars.add(name)
                            serverVarsProperty.set(name, {propertyName, exporter: trueImportString})
                            return `${propertyName}=${name}`
                        }).join(",")}`
                        if(defaultImport != null) {
                            serverVars.add(defaultImport)
                            serverVarsProperty.set(defaultImport, {propertyName: "default", exporter: trueImportString})

                        }
                        const importStringNode = ts.factory.createStringLiteral(importString)
                        let newImportNode = ts.factory.updateImportDeclaration(
                            ast,
                            undefined,
                            undefined,
                            importStringNode,
                            undefined
                        )
                        /** @type {any} */
                        let importNodeString = newImportNode.moduleSpecifier
                        importNodeString.parent = ast
                        /** @type {any} */
                        let astTemp = ast
                        astTemp.moduleSpecifier = importNodeString
                        if(serverImportMap.has(importString)) return {locals, nonLocals}
                        isChanged = true
                        fileServerImportMap.set(ast.getText(), ast.getText().replace(/from.*/, `from "${importString}"`))
                        serverImportMap.set(importString, {
                            defaultImport,
                            namedImports
                        })
                        callNodeCalls.set(importString, {
                            locals: new Set(),
                            function: `async () => await import("${
                                trueImportString
                            }")`,
                            id: file
                        })
                        return {locals, nonLocals}
                    }
                    if(!isServer && isServerImport(ast)) {
                        let defaultImport = ast.importClause?.name?.getText()
                        /**
                         * @type {{
                            name: string,
                            propertyName: string
                         }[]}
                         */
                        let namedImports = []
                        if(
                            "elements" in (ast.importClause?.namedBindings ?? {})
                        ) {
                            /** @type {any} */
                            let {elements = []} = ast.importClause?.namedBindings ?? {}
                            
                            for(let namedImport of elements) {
                                if(!("propertyName" in namedImport)) continue
                                if(!("name" in namedImport)) continue
                                let name = namedImport.name?.getText()
                                let propertyName = namedImport.propertyName?.getText() ?? name
                                namedImports.push({ propertyName, name })
                            }
                        } 
                        const trueImportString = ast.moduleSpecifier
                            .getText()
                            .replace(/^["']server\:/, "")
                            .replace(/["']/g, "")
                        const importString = `__internal_full_client_server_import__${trueImportString}?=${
                            defaultImport ?? ""
                        },${namedImports.map(({propertyName, name}) => {
                            serverVars.add(name)
                            serverVarsProperty.set(name, {
                                propertyName, 
                                exporter: trueImportString.startsWith("/")
                                    ? path.resolve(process.cwd(), `./src${trueImportString}`)
                                    : trueImportString

                            })
                            return `${propertyName}=${name}`
                        }).join(",")}`
                        if(defaultImport != null) {
                            serverVars.add(defaultImport)
                            serverVarsProperty.set(defaultImport, {
                                propertyName: "default", 
                                exporter: trueImportString.startsWith("/")
                                    ? path.resolve(process.cwd(), `./src${trueImportString}`)
                                    : trueImportString

                            })

                        }
                        const importStringNode = ts.factory.createStringLiteral(importString)
                        let newImportNode = ts.factory.updateImportDeclaration(
                            ast,
                            undefined,
                            undefined,
                            importStringNode,
                            undefined
                        )
                        /** @type {any} */
                        let importNodeString = newImportNode.moduleSpecifier
                        importNodeString.parent = ast
                        /** @type {any} */
                        let astTemp = ast
                        astTemp.moduleSpecifier = importNodeString
                        if(serverImportMap.has(importString)) return {locals, nonLocals}
                        isChanged = true
                        fileServerImportMap.set(ast.getText(), ast.getText().replace(/from.*/, `from "${importString}"`))
                        serverImportMap.set(importString, {
                            defaultImport,
                            namedImports
                        })
                        callNodeCalls.set(importString, {
                            locals: new Set(),
                            function: `async () => await import("${
                                trueImportString.startsWith("/")
                                    ? path.resolve(process.cwd(), `./src${trueImportString}`)
                                    : trueImportString
                            }")`,
                            id: file
                        })
                        return {locals, nonLocals}
                    }
                    
                    if(!isServer && isModuleDefaultImport(ast)) {
                        nodeCallIdentifier = ast.importClause?.name?.getText()
                        if(ast.importClause != null) {
                            const libImportClause = ts.factory.updateImportClause(
                                ast.importClause,
                                ast.importClause.isTypeOnly,
                                undefined,
                                ts.factory.createNamedImports([
                                    ts.factory.createImportSpecifier(
                                        false,
                                        undefined,
                                        ts.factory.createIdentifier("callNode")
                                    )
                                ])
                            )
                            /** @type {any} */
                            let astTemp = ast
                            astTemp.importClause = libImportClause
                            const libModuleSpecifier = ts.factory.createStringLiteral("full-client-server-sveltekit")
                            astTemp.moduleSpecifier = libModuleSpecifier
                            astTemp.moduleSpecifier.parent = ast
                            isChanged = true
                            return {locals, nonLocals}
                        }
                    }
                    if(!isServer && isIdenntifierCallExpression(ast, nodeCallIdentifier) && isFunctionNode(ast.arguments[0])) {
                        const id = `${nextId++}`
                        const {nonLocals: nonLocalsInner} = codeTransformAST({
                            ast: ast.arguments[0],
                            file,
                            saveNonLocals: true,
                            isServer: true
                        })
                        let sharedServer = new Set(
                            Array.from(
                                serverVars
                            ).map(name => ({
                                name, 
                                propertyName: serverVarsProperty.get(name)?.propertyName ?? "",
                                exporter: serverVarsProperty.get(name)?.exporter ?? ""
                            })).filter(
                                (
                                    {name, propertyName, exporter}
                                ) => nonLocalsInner.has(name) 
                                && !prevLocals.has(name)
                                && propertyName != ""
                                && exporter != ""
                            )
                        )
                        let shared = new Set(
                            Array.from(nonLocalsInner).filter(
                                x => prevLocals.has(x) && !globalsConst.has(x) && !serverVars.has(x)
                            )
                        ) 
                        callNodeCalls.set(
                            `${file}-${id}`, 
                            {
                                function: ast.arguments[0].getText(),
                                locals: shared,
                                id: file,
                                sharedServer
                            }
                        )
                        const libCall = ts.factory.createIdentifier("callNode")
                        /** @type {any} */
                        const callNodeCall = ts.factory.createCallExpression(
                            libCall,
                            undefined,
                            [
                                ts.factory.createStringLiteral(`${file}-${id}`),
                                ts.factory.createArrayLiteralExpression([
                                    ...(shared ?? [])
                                ].map(s => ts.factory.createIdentifier(s))),
                                ts.factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                        [...(shared ?? [])].map(s => ts.factory.createParameterDeclaration(
                                            undefined,
                                            undefined,
                                            `${s}Updated`
                                        )),
                                    undefined,
                                    undefined,
                                    ts.factory.createBlock([...(shared ?? [])].map(createUpdateBlock), true)
                                )
                            ]
                        )
                        callNodeCall.parent = ast.parent
                        callNodeCall.pos = ast.pos
                        callNodeCall.end = ast.end
                        Object.defineProperties(ast, Object.getOwnPropertyDescriptors(callNodeCall))
                        isChanged = true
                        return {locals, nonLocals}
                    }
                    if(!isServer && callerInSet(ast, serverVars)) {
                        const id = `${nextId++}`
                        /** @type {Set<string>} */
                        let nonLocalsInner = new Set()
                        for(let arg of ast.arguments) {
                            codeTransformAST({
                                ast: arg,
                                file,
                                saveNonLocals: true,
                                isServer: true
                            }).nonLocals.forEach(name => nonLocalsInner.add(name))
                        }
                        codeTransformAST({
                            ast: ast.expression,
                            file,
                            saveNonLocals: true,
                            isServer: true
                        }).nonLocals.forEach(name => nonLocalsInner.add(name))
                        let sharedServer = new Set(
                            Array.from(
                                serverVars
                            ).map(name => ({
                                name, 
                                propertyName: serverVarsProperty.get(name)?.propertyName ?? "",
                                exporter: serverVarsProperty.get(name)?.exporter ?? ""
                            })).filter(
                                (
                                    {name, propertyName, exporter}
                                ) => nonLocalsInner.has(name) 
                                && !prevLocals.has(name)
                                && propertyName != ""
                                && exporter != ""
                            )
                        )
                        let shared = new Set(
                            Array.from(nonLocalsInner).filter(
                                x => prevLocals.has(x) && !globalsConst.has(x) && !serverVars.has(x)
                            )
                        ) 
                        callNodeCalls.set(
                            `${file}-${id}`, 
                            {
                                function: `() => ${ast.getText()}`,
                                locals: shared,
                                id: file,
                                sharedServer
                            }
                        )
                        const libCall = ts.factory.createIdentifier("callNode")
                        /** @type {any} */
                        const callNodeCall = ts.factory.createCallExpression(
                            libCall,
                            undefined,
                            [
                                ts.factory.createStringLiteral(`${file}-${id}`),
                                ts.factory.createArrayLiteralExpression([
                                    ...(shared ?? [])
                                ].map(s => ts.factory.createIdentifier(s))),
                                ts.factory.createArrowFunction(
                                    undefined,
                                    undefined,
                                        [...(shared ?? [])].map(s => ts.factory.createParameterDeclaration(
                                            undefined,
                                            undefined,
                                            `${s}Updated`
                                        )),
                                    undefined,
                                    undefined,
                                    ts.factory.createBlock([...(shared ?? [])].map(createUpdateBlock), true)
                                )
                            ]
                        )
                        callNodeCall.parent = ast.parent
                        callNodeCall.pos = ast.pos
                        callNodeCall.end = ast.end
                        Object.defineProperties(ast, Object.getOwnPropertyDescriptors(callNodeCall))
                        isChanged = true
                        return {locals, nonLocals}
                    }
                    if(ts.isPropertyAccessExpression(ast)) {
                        return codeTransformAST({
                            ast: getPropertyExpressionParent(ast),
                            isDeclaration: isNodeDeclaration(ast, isDeclaration, isBindingName),
                            isBindingName: false,
                            file,
                            prevLocals,
                            saveNonLocals,
                            isServer
                        })
                    }
                    for(let node of ast.getChildren()) {
                        const transformASTResult = codeTransformAST({
                
                            ast: node, 
                            isDeclaration: isNodeDeclaration(ast, isDeclaration, isBindingName),
                            isBindingName: ts.isBindingName(ast) || isBindingName,
                            file,
                            prevLocals: new Set([...prevLocals, ...locals]),
                            saveNonLocals,
                            isServer
                        }
                        )
                        if(saveNonLocals)
                            for(let nonLocal of transformASTResult.nonLocals) {
                                nonLocals.add(nonLocal)
                            }

                        for(let local of transformASTResult.locals) {
                            locals.add(local)
                        }
                    }
                    if(ts.isIdentifier(ast) && isDeclaration) {
                        locals.add(ast.getText())
                    }
                    if(ts.isIdentifier(ast) && !isDeclaration && !prevLocals.has(ast.getText()) && saveNonLocals) {
                        nonLocals.add(ast.getText())
                    }
                    return {
                        locals,
                        nonLocals
                    }
                }
                codeTransformAST({ast, file: id, isServer: false})
                
                fileServerImportMap
                if(isChanged) {
                    const serverImport = createServerImport(callNodeCalls)
                    await fs.writeFile(path.resolve(cwd, `${wsOutput}.js`), serverImport)
                    const newCode = printer.printNode(ts.EmitHint.Unspecified, ast, ast)
                    return newCode
                }
            }
        }
    ]
}
