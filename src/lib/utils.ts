import ts,{type CallExpression, type FunctionDeclaration, type Identifier, type ImportDeclaration, type ArrowFunction, type PropertyAccessExpression} from "typescript";

export function isModuleDefaultImport(node: ts.Node): node is ImportDeclaration {
    if(!ts.isImportDeclaration(node)) return false
    return /['"]full-client-server-sveltekit["']/.test(node.moduleSpecifier!.getText()) && node.importClause?.name != null
}

export function isServerImport(node: ts.Node): node is ImportDeclaration {
    if(!ts.isImportDeclaration(node)) return false
    return node.moduleSpecifier.getText().startsWith("'server:") 
        || node.moduleSpecifier.getText().startsWith('"server:')
}
export function isServerNPMImport(node: ts.Node): node is ImportDeclaration {
    if(!ts.isImportDeclaration(node)) return false
    return node.moduleSpecifier.getText().startsWith("'server:npm:")
        || node.moduleSpecifier.getText().startsWith('"server:npm:')

}

export function isIdenntifierCallExpression(callExpression: ts.Node, identifier: string | undefined): callExpression is CallExpression {
    if(!ts.isCallExpression(callExpression) || !ts.isIdentifier(callExpression.expression)) return false
    return callExpression.expression.getText() === identifier
}
export function getPropertyExpressionParent(node: PropertyAccessExpression): ts.Expression {
    if(ts.isPropertyAccessExpression(node.expression)) return getPropertyExpressionParent(node.expression)
    return node.expression
}
export function callerInSet(callExpression: ts.Node, set: Set<string>): callExpression is CallExpression {
    if(!ts.isCallExpression(callExpression)) return false
    if(ts.isPropertyAccessExpression(callExpression.expression)) {
        return set.has(getPropertyExpressionParent(callExpression.expression)?.getText() ?? "")
    }
    if(!ts.isIdentifier(callExpression.expression)) return false
    return set.has(callExpression.expression.getText())
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

