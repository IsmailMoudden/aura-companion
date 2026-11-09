// Explicit signed-release configuration. Missing credentials fail the build.
const base = require('./package.json').build;
module.exports = {
  ...base,
  forceCodeSigning: true,
  mac: { ...base.mac, identity: undefined, hardenedRuntime: true, notarize: true },
};
