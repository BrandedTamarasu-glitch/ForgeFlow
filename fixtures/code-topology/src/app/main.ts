import { runFeature } from '../features/feature';
import { sharedValue } from '../shared';
import type { User } from '../lib/types';
import { helper as helperFromJsSpecifier } from '../lib/helper.js';
const legacy = require('../lib/legacy');

export function main(user: User) {
  return runFeature(user.name) + sharedValue + helperFromJsSpecifier(user.name) + legacy.suffix;
}
