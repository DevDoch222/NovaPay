module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated / Worklets plugin is included by babel-preset-expo (SDK 54+)
  };
};
