import WebSockets from "@carlosv2/adapter-node-ws/plugin";
import ts, { type ConciseBody, type Identifier } from "typescript";
import path from "path"
import fs from "fs-extra"
import { isFunctionNode, isIdenntifierCallExpression, isModuleDefaultImport, isNodeDeclaration } from "./utils";

const globalsConst = new Set(["console"])

const wsImport = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
        true,
        undefined,
        ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier("WebSocketServer")
            )
        ]),
    ),
    ts.factory.createStringLiteral("ws")
)
const wsEventImportStatement = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
        false,
        ts.factory.createIdentifier("WSEvents"),
        ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
                true,
                undefined,
                ts.factory.createIdentifier("WSEventHandler")
            )
        ])
    ),
    ts.factory.createStringLiteral("ws-events")
)

const serializeDeserializeImportStatement = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier("serialize")
            ),
            ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier("deserialize")
            )
        ])
    ),
    ts.factory.createStringLiteral("full-client-server-sveltekit")
)

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

function createServerImport(callNodeCalls: Map<string, {locals: Set<string>, function: ts.ArrowFunction}>, file = ts.createSourceFile("ws.ts", "", ts.ScriptTarget.Latest)) {
    const printer = ts.createPrinter()
    let wsCalls: ts.Statement[] = []
    for(let [key, value] of callNodeCalls) {
        
        wsCalls.push(ts.factory.createExpressionStatement(ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier("wsEvents"),
                "on"
            ),
            undefined,
            [
                ts.factory.createStringLiteral(key),
                ts.factory.createFunctionExpression(
                    [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
                    undefined,
                    undefined,
                    [],
                    [
                        ts.factory.createParameterDeclaration(
                            undefined,
                            undefined,
                            "str"
                        )
                    ],
                    undefined,
                    ts.factory.createBlock([
                        ts.factory.createVariableStatement(
                            [],
                            ts.factory.createVariableDeclarationList(
                                [
                                    ts.factory.createVariableDeclaration(
                                        ts.factory.createArrayBindingPattern(["id", ...value.locals, "update"].map(
                                            s => ts.factory.createBindingElement(
                                                undefined,
                                                undefined,
                                                ts.factory.createIdentifier(s)
                                            )
                                        )),
                                        undefined,
                                        undefined,
                                        ts.factory.createCallExpression(
                                            ts.factory.createIdentifier("deserialize"),
                                            undefined,
                                            [
                                                ts.factory.createIdentifier("str"),
                                                ts.factory.createStringLiteral("front"),
                                                ts.factory.createIdentifier("wsEvents")
                                            ]
                                        )
                                    )
                                ],
                                ts.NodeFlags.Let
                            )
                        ),
                        ts.factory.createVariableStatement(
                            [],
                            ts.factory.createVariableDeclarationList(
                                [
                                    ts.factory.createVariableDeclaration(
                                        "caller",
                                        undefined,
                                        undefined,
                                        value.function
                                    )
                                ],
                                ts.NodeFlags.Let
                            )
                        ),
                        ts.factory.createVariableStatement(
                            undefined,
                            ts.factory.createVariableDeclarationList(
                                [
                                    ts.factory.createVariableDeclaration(
                                        "result",
                                        undefined,
                                        undefined,
                                        ts.factory.createAwaitExpression(ts.factory.createCallExpression(
                                            ts.factory.createIdentifier("caller"),
                                            undefined,
                                            undefined
                                        ))
                                    )
                                ],
                                ts.NodeFlags.Const
                            )
                        ),
                        ts.factory.createExpressionStatement(
                            ts.factory.createCallExpression(
                                ts.factory.createIdentifier("update"),
                                undefined,
                                [...value.locals].map(s => ts.factory.createIdentifier(s))
                            )
                        ),
                        ts.factory.createExpressionStatement(
                            ts.factory.createCallExpression(
                                ts.factory.createPropertyAccessExpression(
                                    ts.factory.createIdentifier("wsEvents"),
                                    "emit"
                                ),
                                undefined,
                                [
                                    ts.factory.createTemplateExpression(ts.factory.createTemplateHead(
                                        `${key}-`
                                    ), [ts.factory.createTemplateSpan(
                                        ts.factory.createIdentifier("id"),
                                        ts.factory.createTemplateTail("")
                                    )]),
                                    ts.factory.createCallExpression(
                                        ts.factory.createIdentifier("serialize"),
                                        undefined,
                                        [
                                            ts.factory.createIdentifier("result"),
                                            ts.factory.createStringLiteral("back"),
                                            ts.factory.createIdentifier("wsEvents")
                                        ]
                                    )
                                ]
                            )
                        )
                    ], true),
                ),
            ]
        )))
    }
    const wssConnectionBlock = ts.factory.createBlock([
        ts.factory.createVariableStatement(
            undefined,
            ts.factory.createVariableDeclarationList(
                    [
                    ts.factory.createVariableDeclaration(
                        "wsEvents",
                        undefined,
                        undefined,
                        ts.factory.createCallExpression(
                            ts.factory.createIdentifier("WSEvents"),
                            undefined,
                            [
                                ts.factory.createIdentifier("ws")
                            ]
                        )
                    )
                ],
                ts.NodeFlags.Const
            ),
        ),
        ...wsCalls,
        ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
                ts.factory.createIdentifier("cb"),
                undefined,
                [
                    ts.factory.createIdentifier("wsEvents")
                ]
            )
        )
    ], true)
    const returnHandlerFunction = ts.factory.createFunctionExpression(
        undefined,
        undefined,
        "handleWse",
        undefined,
        [
            ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                "wss",

            )
        ],
        undefined,
        ts.factory.createBlock([
            ts.factory.createExpressionStatement(
                ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier("wss"),
                        "on"
                    ),
                    undefined,
                    [
                        ts.factory.createStringLiteral("connection"),
                        ts.factory.createArrowFunction(
                            undefined,
                            undefined,
                            [
                                ts.factory.createParameterDeclaration(
                                    undefined,
                                    undefined,
                                    "ws"
                                )
                            ],
                            undefined,
                            undefined,
                            wssConnectionBlock
                        )
                    ]
                )
            )
        ], true)
    )

    const defaultExportStatement = ts.factory.createExportDefault(
        ts.factory.createFunctionExpression(
            undefined,
            undefined,
            "handleWs",
            undefined,
            [
                ts.factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    "cb",
                    undefined,
                    ts.factory.createFunctionTypeNode(
                        undefined,
                        [
                            ts.factory.createParameterDeclaration(
                                undefined,
                                undefined,
                                "wse",
                                undefined,
                                ts.factory.createTypeReferenceNode("WSEventHandler"),
                            )
                        ],
                        ts.factory.createTypeReferenceNode("any")
                    )
                )
            ],
            ts.factory.createFunctionTypeNode(
                undefined,
                [
                    ts.factory.createParameterDeclaration(
                        undefined,
                        undefined,
                        "wse",
                        undefined,
                        ts.factory.createTypeReferenceNode("WebSocketServer"),

                    )
                ],
                ts.factory.createTypeReferenceNode("void")
            ),
            ts.factory.createBlock([
                ts.factory.createReturnStatement(
                    returnHandlerFunction
                )
            ], true)
        )
    )
    
    const exportString = printer.printNode(
        ts.EmitHint.Unspecified, 
        defaultExportStatement, 
        file
    )
    const wsImportString = printer.printNode(
        ts.EmitHint.Unspecified,
        wsImport,
        file
    )
    const wsEventImportString = printer.printNode(
        ts.EmitHint.Unspecified,
        wsEventImportStatement,
        file
    )
    const libImportString = printer.printNode(
        ts.EmitHint.Unspecified,
        serializeDeserializeImportStatement,
        file
    )
    return `${wsImportString}\n${wsEventImportString}\n${libImportString}\n${exportString}`
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
    const callNodeCalls: Map<string, {locals: Set<string>, function: ts.ArrowFunction}> = new Map();
    return {
        name: 'transform-node',
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
                            function: ast.arguments[0] as ts.ArrowFunction,
                            locals: shared
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
