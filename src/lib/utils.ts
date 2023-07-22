import ts,{type CallExpression, type FunctionDeclaration, type Identifier, type ImportDeclaration, type ArrowFunction} from "typescript";

export function isModuleDefaultImport(node: ts.Node): node is ImportDeclaration {
    if(!ts.isImportDeclaration(node)) return false
    return node.moduleSpecifier.getText() === '"full-client-server-sveltekit"' && node.importClause?.name != null
}

export function isIdenntifierCallExpression(callExpression: ts.Node, identifier: string | undefined): callExpression is CallExpression {
    if(!ts.isCallExpression(callExpression) || !ts.isIdentifier(callExpression.expression)) return false
    return callExpression.expression.getText() === identifier
}

export function isFunctionNode(node: ts.Node): node is FunctionDeclaration | ArrowFunction {
    return ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)
}

export function isNodeDeclaration(node: ts.Node, isDeclaration: boolean, isBindingName: boolean){
    return (ts.isImportDeclaration(node) 
                        || ts.isVariableDeclaration(node)
                        || ts.isClassDeclaration(node)
                        || ts.isInterfaceDeclaration(node)
                        || (ts.isImportClause(node) && !node.isTypeOnly)
                        || ts.isFunctionDeclaration(node)
                        || (ts.isImportSpecifier(node) && !node.isTypeOnly)
                        || (ts.isParameter(node))
                        || (isDeclaration && (isBindingName || ts.isBindingName(node))))
                        && !ts.isBlock(node)
                        && !ts.isPropertyName(node)
}

