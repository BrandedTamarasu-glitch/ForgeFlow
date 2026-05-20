import { sharedValue } from '../shared';
import { helper } from '../lib/helper';
import missing from './missing';
import bad from './bad]#missing';

export function runFeature(name: string) {
  import(`./dynamic-${name}`);
  return `${helper(name)}:${sharedValue}:${missing}:${bad}`;
}
