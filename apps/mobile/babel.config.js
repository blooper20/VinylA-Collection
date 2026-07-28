// react-native-worklets (Reanimated 4's worklets engine, used by
// react-native-draggable-flatlist's Gesture Handler animations) requires its
// Babel plugin, and it must be listed last.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
