import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { storage } from "../src/js/storage.js";
import { evaluateExpression } from "../src/js/expressions.js";
import { NODE_DEFINITIONS } from "../src/js/node-registry.js";

describe("Variables & Credentials Management Suite", () => {
  test("variables CRUD operations work as expected", () => {
    storage.setVariable("TEST_KEY", "https://api.myendpoint.dev");
    const vars = storage.getVariables();
    assert.equal(vars.TEST_KEY, "https://api.myendpoint.dev");

    storage.deleteVariable("TEST_KEY");
    const updatedVars = storage.getVariables();
    assert.equal(updatedVars.TEST_KEY, undefined);
  });

  test("credentials CRUD operations work as expected", () => {
    const cred = storage.saveCredential({
      name: "OpenAI Test Key",
      type: "bearer",
      token: "sk-test-123456789"
    });

    assert.ok(cred.id);
    assert.equal(cred.name, "OpenAI Test Key");

    const fetched = storage.getCredential(cred.id);
    assert.equal(fetched.token, "sk-test-123456789");

    storage.deleteCredential(cred.id);
    const afterDelete = storage.getCredential(cred.id);
    assert.equal(afterDelete, null);
  });

  test("expressions evaluate $vars and $env cleanly", () => {
    const context = {
      $vars: {
        SERVICE_URL: "https://myservice.io",
        PORT: 8080
      }
    };

    const evaluated = evaluateExpression("{{ $vars.SERVICE_URL }}:{{ $vars.PORT }}/v1", context);
    assert.equal(evaluated, "https://myservice.io:8080/v1");

    const evalEnv = evaluateExpression("{{ $env.SERVICE_URL }}", context);
    assert.equal(evalEnv, "https://myservice.io");
  });

  test("http_request definition exists and supports credentialId parameter", () => {
    assert.ok(NODE_DEFINITIONS.http_request);
    assert.equal(NODE_DEFINITIONS.http_request.type, "http_request");
  });
});
