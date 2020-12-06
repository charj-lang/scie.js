const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

/**
 * Utility to read a file as a promise
 */
function readFile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, data) => error ? reject(error) : resolve(data));
    })
}

const wasmBin = fs.readFileSync(path.join(__dirname, './node_modules/vscode-oniguruma/release/onig.wasm')).buffer;
const vscodeOnigurumaLib = oniguruma.loadWASM(wasmBin).then(() => {
    return {
        createOnigScanner(patterns) {
            return new oniguruma.OnigScanner(patterns);
        },
        createOnigString(s) {
            return new oniguruma.OnigString(s);
        }
    };
});

// Create a registry that can create a grammar from a scope name.
const registry = new vsctm.Registry({
    onigLib: vscodeOnigurumaLib,
    loadGrammar: (scopeName) => {
        if (scopeName === 'source.c') {
            // https://github.com/textmate/javascript.tmbundle/blob/master/Syntaxes/JavaScript.plist
            // return readFile('./extensions/C.plist').then(data => vsctm.parseRawGrammar(data.toString()))
            return readFile('./extensions/c.tmLanguage.json').then(data => vsctm.parseRawGrammar(data.toString(), "c.json"))
        }
        console.log(`Unknown scope name: ${scopeName}`);
        return null;
    }
});

// Load the JavaScript grammar and any other grammars included by it async.
registry.loadGrammar('source.c').then(grammar => {
    const text = `#include <stdio.h>
int main(){
    printf("Hello, World!");
    return 0;
}
`.split("\n");
    let ruleStack = vsctm.INITIAL;
    let results = {
        path: '',
        name: 'helloworld.c',
        elements: []
    };
    for (let i = 0; i < text.length; i++) {
        const line = text[i];
        const lineTokens = grammar.tokenizeLine(line, ruleStack);
        for (let j = 0; j < lineTokens.tokens.length; j++) {
            const token = lineTokens.tokens[j];
            let value = line.substring(token.startIndex, token.endIndex);
            results.elements.push({
                line_num: j + 1,
                start_index: token.startIndex,
                end_index: token.endIndex,
                value: value,
                scopes: token.scopes
            })
        }
        ruleStack = lineTokens.ruleStack;
    }

    fs.writeFileSync("scie.json", JSON.stringify(results));
});
