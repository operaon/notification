module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.js'],
  globalSetup: '<rootDir>/tests/setup.js',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
  forceExit: true,
};
