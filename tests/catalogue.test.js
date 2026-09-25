import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogue } from '../src/audio/catalogue.js';
import { normalizeResults } from '../src/audio/search.js';

test('Shared catalogue resolves audio relative to its host and rejects malformed or duplicate entries', () => {
  const track = { id: 'shots', title: 'Shots', url: 'sounds/Shots.mp3' };
  const list = parseCatalogue({
    version: 1,
    tracks: [
      track,
      track,
      null,
      { ...track, id: 'bad', url: 'javascript:alert(1)' },
      { ...track, id: 'external', url: 'https://example.com/test.mp3' },
    ],
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].url, 'https://agascocompte.github.io/colored-music/sounds/Shots.mp3');
  assert.throws(() => parseCatalogue({ tracks: [] }));
  assert.deepEqual(parseCatalogue({ version: 1, tracks: [] }), []);
});

test('Search accepts playable previews with store links, and ignores missing previews or duplicates', () => {
  const track = {
    trackId: 123,
    trackName: '<Test>',
    artistName: 'Artist',
    previewUrl: 'https://audio-ssl.itunes.apple.com/example.m4a',
    trackViewUrl: 'https://music.apple.com/es/album/example/123',
  };
  const results = normalizeResults({
    results: [
      track,
      track,
      { ...track, trackId: 456, previewUrl: undefined },
      { ...track, trackId: 789, trackViewUrl: 'javascript:alert(1)' },
    ],
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, '<Test>');
  assert.equal(results[0].preview, true);
  assert.equal(results[0].id, 'itunes:123');
});
