import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  moduleFileExtensions: ["ts", "tsx", "js"],
  verbose: true,
  collectCoverageFrom: ["src/**/*.ts"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

export default config;

