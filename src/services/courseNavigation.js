// Resume the earliest unfinished module the learner is allowed to open.
export function resumeModule(course, progress) {
  const modules = Object.keys(course.modules || {}).map(Number).sort((a, b) => a - b);
  return modules.find(number => {
    const state = progress[`${course.id}-m${number}`];
    return !state?.passed && (state?.unlocked || number === modules[0] || progress[`${course.id}-m${number - 1}`]?.passed);
  }) || modules[0] || 1;
}
