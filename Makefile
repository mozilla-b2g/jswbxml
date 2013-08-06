.PHONY: test tests check
test tests check: node_modules
	npm test

node_modules: package.json
	npm install
	touch node_modules
