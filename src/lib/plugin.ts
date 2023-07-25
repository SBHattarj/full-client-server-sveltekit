import ts from "typescript";
import { getTsconfig } from "get-tsconfig";
import fse from "fs-extra"
import path from "path"
import fs from "fs-extra"
import { callerInSet, getPropertyExpressionParent, isFunctionNode, isIdenntifierCallExpression, isModuleDefaultImport, isNodeDeclaration, isServerImport, isServerNPMImport } from "./utils.js";
import type { UserConfig } from "vite";
const fullClientServerImport = "full-client-server-sveltekit"
const globalsConst = new Set(["console"])

const imports = `import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "${fullClientServerImport}";
`
function createUpdateBlock(s: string) {
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

function createServerImport(callNodeCalls: Map<string, {locals: Set<string>, function: string, id: string, sharedServer?: Set<{name: string, propertyName: string, exporter: string}>}>, file = ts.createSourceFile("ws.ts", "", ts.ScriptTarget.Latest)) {
    let wsCalls: Set<string> = new Set()
    for(let [key, value] of callNodeCalls) {
        let idString = "id"
        let updateString = "update"
        let callerString = "caller"
        let sharedServer = value.sharedServer ?? new Set()
        let imports = new Map<string, {name: string, propertyName: string}[]>()
        let importedVars = new Set<string>()
        for(let {name, propertyName, exporter} of sharedServer) {
            importedVars.add(name)
            if(imports.get(exporter) == null) {
                imports.set(exporter, [])
            }
            imports.get(exporter)!.push({
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
            wsEvents.on("${key}", async function (this: typeof data, str: string) {
                let [${[idString, ...value.locals,  updateString].join(", ")}] = deserialize(
                    str, 
                    "front", 
                    wsEvents,
                    this.cache
                );${importsString}
                let ${callerString} = ${
                    value.function.replace(
                        /import\((["'`])(\.\.?)/g, 
                        (_: string, quote: string, prefix: string) => {
                            const newPrefix = path.resolve(
                                value.id.replace(/\/[^\/]*$/, ""),
                                prefix
                            )
                            return `import(${quote}${newPrefix}`
                        }
                    )                
                }

                const result = await caller();
                ${updateString}(${[...value.locals].join(", ")});
                wsEvents.emit(\`${key}-$\{${idString}}\`, serialize(
                    result, 
                    "back", 
                    wsEvents,
                    this.cache
                ));
            }.bind(data));
        `)
    }
    const wssConnectionBlock = `
            const wsEvents = WSEvents(ws);
            ${[...wsCalls].join("\n")}
            cb(wsEvents);
    `
    const returnHandlerFunction = `function handleWse(wse) {
        wse.on("connection", ws => {
            let data = {
                cache: {}
            }
            ws.onclose = function () {
                delete (data as any).cache
            }
            ${wssConnectionBlock}
        })
    }
    `
    const defaultExportStatement = `
export default function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return ${returnHandlerFunction}
};
    `
    
    return `${imports}\n${defaultExportStatement}`
}


export function serverBrowserSync() {
    const callNodeCalls: Map<string, {locals: Set<string>, function: string, id: string, sharedServer?: Set<{
        name: string,
        propertyName: string,
        exporter: string
    }>}> = new Map();
    const serverImportMap = new Map<string, {
        defaultImport?: string, 
        namedImports: {
            name: string,
            propertyName: string
        }[]
    }>();
    return {
        name: 'transform-node',
        async config(config: UserConfig, {command}: {command: string}) {
            if(command === "build") return
                
            await fs.writeFile(path.resolve(process.cwd(), "src", "lib", "ws.ts"), `
import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "${fullClientServerImport}";
export default (function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return function handleWse(wss) {
        wss.on("connection", ws => {
            const data = {
                cache: {}
            }
            ws.onclose = function () {
                delete (data as any).cache
            }
            const wsEvents = WSEvents(ws);
            cb(wsEvents);
        });
    };
});
                `)
            
        },
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
                    await fse.writeJson(
                        path.resolve(process.cwd(), ".svelte-kit", "tsconfig.json"), svelteTSConfig.config,
                        {spaces: 4}
                    )
                }
            }
        },
        async resolveId(id: string, importer?: string, {ssr}: {ssr?: boolean} = {}) {
            if(ssr && id.startsWith("server:npm:")) {
                const serverId = id.replace(/^server:npm\:/, "")
                return
            }
            if(ssr && id.startsWith("server:")) {
                const serverId = id.replace(/^server\:/, "")
                return path.resolve(process.cwd(), `./src${serverId}`)
            }
            if(serverImportMap.has(id)) return id
        },
        load(id: string) {
            if(serverImportMap.has(id)) {
                const {defaultImport, namedImports} = serverImportMap.get(id)!
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
        async transform(code: string, id: string, options?: {ssr?: boolean}) {
            const fileServerImportMap = new Map()
            if(!code.includes("full-client-server-sveltekit")) return
            if(options?.ssr) {
                const printer = ts.createPrinter()
                const importsMap = new Map<string, string>()
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
            let nodeCallIdentifier: string | undefined
            let serverVars = new Set<string>()
            let serverVarsProperty = new Map<string, {propertyName: string, exporter: string}>()
            const printer = ts.createPrinter()
            let nextId = 0
            function codeTransformAST({
                ast, 
                isDeclaration = false, 
                isBindingName = false,
                file,
                prevLocals = new Set(),
                saveNonLocals = false,
                isServer
            }: {
                ast: ts.Node,
                file: string,
                isDeclaration?: boolean
                isBindingName?: boolean, 
                top?: boolean,
                prevLocals?: Set<string>,
                saveNonLocals?: boolean
                isServer: boolean
            }) {
                const locals: Set<string> = new Set()
                const nonLocals: Set<string> = new Set()
                if(!isServer && isServerNPMImport(ast)) {
                    let defaultImport = ast.importClause?.name?.getText()
                    let namedImports: {
                        name: string,
                        propertyName: string
                    }[] = []
                    for(let namedImport of ast.importClause?.namedBindings?.getChildren() ?? []) {
                        if(ts.isImportSpecifier(namedImport)) {
                            let propertyName = namedImport.propertyName?.getText() ?? namedImport.name.getText()
                            let name = namedImport.name.getText()
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
                    let importNodeString = newImportNode.moduleSpecifier
                    ;(importNodeString as any).parent = ast
                    ;(ast as any).moduleSpecifier = importNodeString
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
                    let namedImports: {
                        name: string,
                        propertyName: string
                    }[] = []
                    if(
                        "elements" in (ast.importClause?.namedBindings ?? {})
                    ) for(let namedImport of (ast.importClause?.namedBindings as any)?.elements ?? []) {
                        if(!("propertyName" in namedImport)) continue
                        if(!("name" in namedImport)) continue
                        let name = (namedImport.name as any)?.getText()
                        let propertyName = (namedImport.propertyName as any)?.getText() ?? name
                        namedImports.push({ propertyName, name })
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
                    let importNodeString = newImportNode.moduleSpecifier
                    ;(importNodeString as any).parent = ast
                    ;(ast as any).moduleSpecifier = importNodeString
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
                    const libImportClause = ts.factory.updateImportClause(
                        ast.importClause!,
                        ast.importClause!.isTypeOnly,
                        undefined,
                        ts.factory.createNamedImports([
                            ts.factory.createImportSpecifier(
                                false,
                                undefined,
                                ts.factory.createIdentifier("callNode")
                            )
                        ])
                    )
                    ;(ast as any).importClause = libImportClause
                    const libModuleSpecifier = ts.factory.createStringLiteral("full-client-server-sveltekit")
                    ;(ast as any).moduleSpecifier = libModuleSpecifier
                    ;(ast.moduleSpecifier as any).parent = ast
                    isChanged = true
                    return {locals, nonLocals}
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
                            propertyName: serverVarsProperty.get(name)!.propertyName,
                            exporter: serverVarsProperty.get(name)!.exporter
                        })).filter(
                            ({name}) => nonLocalsInner.has(name) && !prevLocals.has(name)
                        )
                    )
                    let shared = new Set(
                        Array.from(nonLocalsInner).filter(
                            x => prevLocals.has(x) && !globalsConst.has(x) && !serverVars.has(x)
                        )
                    ) 
                    console.log(shared, sharedServer, nonLocalsInner)
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
                    const callNodeCall = ts.factory.createCallExpression(
                        libCall,
                        undefined,
                        [
                            ts.factory.createStringLiteral(`${file}-${id}`),
                            ts.factory.createArrayLiteralExpression([
                                ...(shared ?? [] as string[])
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
                    ;(callNodeCall as any).parent = ast.parent
                    ;(callNodeCall as any).pos = ast.pos
                    ;(callNodeCall as any).end = ast.end
                    Object.defineProperties(ast, Object.getOwnPropertyDescriptors(callNodeCall))
                    isChanged = true
                    return {locals, nonLocals}
                }
                if(!isServer && callerInSet(ast, serverVars)) {
                    const id = `${nextId++}`
                    let nonLocalsInner = new Set<string>()
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
                            propertyName: serverVarsProperty.get(name)!.propertyName,
                            exporter: serverVarsProperty.get(name)!.exporter
                        })).filter(
                            ({name}) => nonLocalsInner.has(name) && !prevLocals.has(name)
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
                    const callNodeCall = ts.factory.createCallExpression(
                        libCall,
                        undefined,
                        [
                            ts.factory.createStringLiteral(`${file}-${id}`),
                            ts.factory.createArrayLiteralExpression([
                                ...(shared ?? [] as string[])
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
                    ;(callNodeCall as any).parent = ast.parent
                    ;(callNodeCall as any).pos = ast.pos
                    ;(callNodeCall as any).end = ast.end
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
                            console.log("non local", nonLocal)
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
                    console.log(ast.getText())
                    nonLocals.add(ast.getText())
                    console.log(nonLocals)
                }
                return {
                    locals,
                    nonLocals
                }
            }
            codeTransformAST({ast, file: id, isServer: false})
            
            fileServerImportMap
            if(isChanged) {
                const serverImport = createServerImport(callNodeCalls, ast)
                await fs.writeFile(path.resolve(process.cwd(), "src", "lib", "ws.ts"), serverImport)
                const newCode = printer.printNode(ts.EmitHint.Unspecified, ast, ast)
                return newCode
            }
        }
    }
}
