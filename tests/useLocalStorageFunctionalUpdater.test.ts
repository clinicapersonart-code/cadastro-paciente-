import * as assert from 'node:assert/strict';
import { resolveLocalStorageUpdate } from '../hooks/useLocalStorage';

const initial = ['existing'];
const withCreated = resolveLocalStorageUpdate(initial, prev => [...prev, 'created']);
const withGoogleId = resolveLocalStorageUpdate(withCreated, prev => prev.map(item => item === 'created' ? 'created-with-google-id' : item));

assert.deepEqual(withGoogleId, ['existing', 'created-with-google-id']);
console.log('useLocalStorage functional updater ok');
