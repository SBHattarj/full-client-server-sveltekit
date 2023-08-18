import ts from "typescript";

/**
* @typedef {import("typescript").CallExpression} CallExpression
* @typedef {import("typescript").FunctionDeclaration} FunctionDeclaration
* @typedef {import("typescript").ImportDeclaration} ImportDeclaration
* @typedef {import("typescript").ArrowFunction} ArrowFunction
* @typedef {import("typescript").PropertyAccessExpression} PropertyAccessExpression
*/


/**
 * @param {ts.Node} node
 * @return {node is ImportDeclaration}
 */
export function isModuleDefaultImport(node) {
    if(!ts.isImportDeclaration(node)) return false
    return /['"]full-client-server-sveltekit["']/.test(node.moduleSpecifier.getText()) && node.importClause?.name != null
}

/**
 * @param {ts.Node} node
 * @return {node is ImportDeclaration}
 */
export function isServerImport(node) {
    if(!ts.isImportDeclaration(node)) return false
    return node.moduleSpecifier.getText().startsWith("'server:") 
        || node.moduleSpecifier.getText().startsWith('"server:')
}

/**
 * @param {ts.Node} node
 * @return {node is ImportDeclaration}
 */
export function isServerNPMImport(node) {
    if(!ts.isImportDeclaration(node)) return false
    return node.moduleSpecifier.getText().startsWith("'server:npm:")
        || node.moduleSpecifier.getText().startsWith('"server:npm:')

}

/**
 * @param {ts.Node} callExpression
 * @param {string | undefined} identifier
 * @return {callExpression is CallExpression}
 */
export function isIdenntifierCallExpression(callExpression, identifier) {
    if(!ts.isCallExpression(callExpression) || !ts.isIdentifier(callExpression.expression)) return false
    return callExpression.expression.getText() === identifier
}

/**
 * @param {PropertyAccessExpression} node
 * @return {ts.Expression}
 */
export function getPropertyExpressionParent(node) {
    if(ts.isPropertyAccessExpression(node.expression)) return getPropertyExpressionParent(node.expression)
    return node.expression
}

/**
 * @param {ts.Node} callExpression
 * @param {Set<string>} set
 * @return {callExpression is CallExpression}
 */
export function callerInSet(callExpression, set) {
    if(!ts.isCallExpression(callExpression)) return false
    if(ts.isPropertyAccessExpression(callExpression.expression)) {
        return set.has(getPropertyExpressionParent(callExpression.expression)?.getText() ?? "")
    }
    if(!ts.isIdentifier(callExpression.expression)) return false
    return set.has(callExpression.expression.getText())
}

/**
 * @param {ts.Node} node
 * @return {node is FunctionDeclaration | ArrowFunction}
 */
export function isFunctionNode(node) {
    return ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)
}

/**
 * @param {ts.Node} node
 * @param {boolean} isDeclaration
 * @param {boolean} isBindingName
 */
export function isNodeDeclaration(node, isDeclaration, isBindingName) {
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

