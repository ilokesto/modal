import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

test('declaration build: public callables and facade methods -> retain machine-readable JSDoc tags', async () => {
  const text = await readFile(new URL('../../dist/index.d.ts', import.meta.url), 'utf8');
  const file = ts.createSourceFile('index.d.ts', text, ts.ScriptTarget.Latest, true);
  const exported = new Set(file.statements.filter(ts.isExportDeclaration)
    .flatMap(statement => statement.exportClause && ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements.filter(element => !element.isTypeOnly)
        .map(element => (element.propertyName ?? element.name).text)
      : []));
  const targets = [];
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && exported.has(statement.name?.text)) {
      targets.push(statement);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (exported.has(declaration.name.getText(file)) && declaration.type && ts.isTypeLiteralNode(declaration.type)) {
          targets.push(...declaration.type.members.filter(member =>
            ts.isMethodSignature(member) || (ts.isPropertySignature(member) && member.type && ts.isFunctionTypeNode(member.type))));
        }
      }
    }
  }

  const retained = targets.map(node => ({
    name: node.name.getText(file),
    tags: ts.getJSDocTags(node).map(tag => tag.tagName.text),
  }));

  assert.ok(retained.length > 0, 'The declaration audit must discover public callables.');
  for (const target of retained) {
    assert.ok(target.tags.includes('description'), `${target.name} lost @description in the declaration build.`);
    assert.ok(target.tags.includes('example'), `${target.name} lost @example in the declaration build.`);
  }
});
