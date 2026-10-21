import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
// Exercise the actual TS provider implementation, without bundling or installing a test runner.
const source = await readFile(
  new URL("../lib/iot.ts", import.meta.url),
  "utf8",
);
const compiled = ts
  .transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  .outputText.replace(
    /(["'])\.\/domain\.mjs\1/,
    JSON.stringify(new URL("../lib/domain.mjs", import.meta.url).href),
  );
const { MockTuyaProvider, TuyaCloudProvider } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
test("actual mock adapter confirms valid online capabilities and rejects invalid/offline commands", async () => {
  const d = {
      id: "synthetic",
      online: true,
      capabilities: {
        switch: { type: "boolean" },
        temperature: { type: "number", min: 16, max: 30 },
      },
      state: { switch: false, temperature: 24 },
    },
    p = new MockTuyaProvider([d]);
  assert.equal(
    (await p.sendDeviceCommand(d.id, { code: "switch", value: true })).state
      .switch,
    true,
  );
  await assert.rejects(
    p.sendDeviceCommand(d.id, { code: "temperature", value: 99 }),
  );
  assert.equal(d.state.temperature, 24);
  d.online = false;
  await assert.rejects(
    p.sendDeviceCommand(d.id, { code: "switch", value: false }),
  );
  assert.equal(d.state.switch, true);
  await assert.rejects(p.getDeviceStatus("other-room"));
  assert.equal((await p.listDevices()).length, 1);
});
test("unimplemented Tuya live adapter fails closed for every operation without network", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw Error("Network must not run");
  };
  try {
    const p = new TuyaCloudProvider();
    for (const call of [
      () => p.listDevices(),
      () => p.getDeviceStatus("device"),
      () => p.getDeviceCapabilities("device"),
      () => p.sendDeviceCommand("device", { code: "switch", value: true }),
      () => p.syncDevices(),
    ])
      await assert.rejects(call(), /belum dikonfigurasi dan diverifikasi/);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = original;
  }
});
