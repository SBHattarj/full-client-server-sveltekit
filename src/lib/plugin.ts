import WebSockets from "@carlosv2/adapter-node-ws/plugin";
import ts, { type ConciseBody, type Identifier } from "typescript";
import path from "path"
import fs from "fs-extra"
import { isFunctionNode, isIdenntifierCallExpression, isModuleDefaultImport, isNodeDeclaration } from "./utils.js";

const globalsConst = new Set(["console"])

const imports = `import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "full-${""}client-server-sveltekit";
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
    return ifBlock
}

function createServerImport(callNodeCalls: Map<string, {locals: Set<string>, function: string, id: string}>, file = ts.createSourceFile("ws.ts", "", ts.ScriptTarget.Latest)) {
    const printer = ts.createPrinter()
    let wsCalls: Set<string> = new Set()
    for(let [key, value] of callNodeCalls) {
        let idString = "id"
        let updateString = "update"
        let callerString = "caller"
        while(value.locals.has(idString)) {
            idString = `${idString}1`
        }
        while(value.locals.has(updateString)) {
            updateString = `${updateString}1`
        }
        while(value.locals.has(callerString)) {
            callerString = `${callerString}1`
        }
        wsCalls.add(`
            wsEvents.on("${key}", async function (str) {
                let [${[idString, ...value.locals,  updateString].join(", ")}] = deserialize(str, "front", wsEvents);
                let ${callerString} = ${
                    value.function.replace(
                        /import\((["'`])\.?/g, 
                        `import($1${
                            value.id.replace(
                                /\/[^\/]*$/, 
                                ""
                            )
                        }`
                    ).replace(
                        /import\((["'`])\.\./g, 
                        `import($1${value.id.replace(
                            /\/[^\/]*$/, 
                            ""
                        )}`
                    )
                }

                const result = await caller();
                update(${[...value.locals].join(", ")});
                wsEvents.emit(\`${key}-$\{${idString}}\`, serialize(result, "back", wsEvents));
            });
        `)
    }
    const wssConnectionBlock = `
            const wsEvents = WSEvents(ws);
            ${[...wsCalls].join("\n")}
            cb(wsEvents);
    `
    const returnHandlerFunction = `function handleWse(wse) {
        wse.on("connection", ws => {
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

function fixRelativeImport(ast: ts.Node, file: string) {
    if(ts.isCallExpression(ast)) {
        if(ast.expression.getText() === "import") {
            console.log(ast.arguments[0].getText())
            if(ts.isStringLiteral(ast.arguments[0]) && (ast.arguments[0].text.startsWith("./") || ast.arguments[0].text.startsWith("../"))) {
                const newImportPath = path.resolve(file.replace(/\/[^\/]+$/, ""), ast.arguments[0].getText().replaceAll('"', "").replaceAll("'", ""))
                console.log(newImportPath)
                console.log(newImportPath)
                const newImportPathNode = ts.factory.createStringLiteral(newImportPath)
                const newImportCall = ts.factory.createCallExpression(
                    ast.expression,
                    undefined,
                    [
                        newImportPathNode
                    ]
                )
                ;(newImportCall as any).parent = ast.parent
                ;(newImportCall as any).pos = ast.pos
                ;(newImportCall as any).end = ast.end
                Object.defineProperties(ast, Object.getOwnPropertyDescriptors(newImportCall))
            }
        }
    }
    for(let child of ast.getChildren()) fixRelativeImport(child, file)
}

export function serverBrowserSync() {
    const callNodeCalls: Map<string, {locals: Set<string>, function: string, id: string}> = new Map();
    return {
        name: 'transform-node',
        async config(_: any, {command}: {command: string}) {
            if(command === "build") return
                await fs.writeFile(path.resolve(process.cwd(), "src", "lib", "ws.ts"), `
import type { WebSocketServer } from "ws";
import WSEvents, { type WSEventHandler } from "ws-events";
import { serialize, deserialize } from "full${""}-client-server-sveltekit";
export default (function handleWs(cb: (wse: WSEventHandler) => any): (wse: WebSocketServer) => void {
    return function handleWse(wss) {
        wss.on("connection", ws => {
            const wsEvents = WSEvents(ws);
            cb(wsEvents);
        });
    };
});
                `)
            
        },
        async transform(code: string, id: string, options?: {ssr?: boolean}) {
            if(!code.includes("full-client-server-sveltekit")) return
            if(options?.ssr) return
            let isChanged = false
            let ast = ts.createSourceFile(
                id,
                code,
                ts.ScriptTarget.Latest,
                true
            )
            let nodeCallIdentifier: string | undefined
            const printer = ts.createPrinter()
            let nextId = 0
            function codeTransformAST({
                ast, 
                isDeclaration = false, 
                isBindingName = false,
                file,
                prevLocals = new Set(),
                saveNonLocals = false
            }: {
                ast: ts.Node,
                file: string,
                isDeclaration?: boolean
                isBindingName?: boolean, 
                top?: boolean,
                prevLocals?: Set<string>,
                saveNonLocals?: boolean
            }) {
                const locals: Set<string> = new Set()
                const nonLocals: Set<string> = new Set()
                if(isModuleDefaultImport(ast)) {
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
                if(isIdenntifierCallExpression(ast, nodeCallIdentifier) && isFunctionNode(ast.arguments[0])) {
                    const id = `${nextId++}`
                    const {nonLocals: nonLocalsInner} = codeTransformAST({
                        ast: ast.arguments[0],
                        file,
                        saveNonLocals: true
                    })
                    let shared = new Set(Array.from(nonLocalsInner).filter(x => prevLocals.has(x) && !globalsConst.has(x)))
                    fixRelativeImport(ast.arguments[0].body, file)
                    callNodeCalls.set(
                        `${file}-${id}`, 
                        {
                            function: ast.arguments[0].getText(),
                            locals: shared,
                            id: file
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
                for(let node of ast.getChildren()) {
                    const transformASTResult = codeTransformAST({
            
                        ast: node, 
                        isDeclaration: isNodeDeclaration(ast, isDeclaration, isBindingName),
                        isBindingName: ts.isBindingName(ast) || isBindingName,
                        file,
                        prevLocals: new Set([...prevLocals, ...locals]),
                        saveNonLocals
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
            codeTransformAST({ast, file: id})
            
            if(isChanged) {
                const serverImport = createServerImport(callNodeCalls, ast)
                await fs.writeFile(path.resolve(process.cwd(), "src", "lib", "ws.ts"), serverImport)
                return printer.printNode(ts.EmitHint.Unspecified, ast, ast)
            }
        }
    }
}
