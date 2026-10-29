import assert from 'node:assert/strict';
import test from 'node:test';
import { resumeModule } from '../src/services/courseNavigation.js';

const course = { id: 'course', modules: { 1: {}, 2: {}, 3: {} } };

test('a new learner starts at the first module, including courses with another ID', () => {
  assert.equal(resumeModule(course, {}), 1);
});

test('refresh resumes the earliest unfinished module rather than a later unlocked module', () => {
  assert.equal(resumeModule(course, {
    'course-m1': { passed: true },
    'course-m2': { passed: false, unlocked: true },
    'course-m3': { passed: false, unlocked: true }
  }), 2);
});

test('passing the previous module allows resuming before its unlock flag is refreshed', () => {
  assert.equal(resumeModule(course, {
    'course-m1': { passed: true },
    'course-m2': { passed: true },
    'course-m3': { passed: false, unlocked: false }
  }), 3);
});

test('a completed course opens its first module for review', () => {
  assert.equal(resumeModule(course, {
    'course-m1': { passed: true },
    'course-m2': { passed: true },
    'course-m3': { passed: true }
  }), 1);
});
