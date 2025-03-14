import { transformPRBody } from '../transformPRBody';

// Mock asana task title fetcher
const mockFetchTaskTitle = jest.fn();

beforeEach(() => {
  mockFetchTaskTitle.mockReset();
});

describe('transformPRBody', () => {
  test('should return empty body for empty input', async () => {
    const result = await transformPRBody('', mockFetchTaskTitle);
    expect(result.body).toBe('');
    expect(result.changesApplied).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(mockFetchTaskTitle).not.toHaveBeenCalled();
  });

  test('should transform plain Asana URLs to markdown links', async () => {
    mockFetchTaskTitle.mockResolvedValueOnce('Task Title');

    const input = 'Check this task: https://app.asana.com/0/123456/789012';
    const result = await transformPRBody(input, mockFetchTaskTitle);

    expect(result.body).toBe(
      'Check this task: [Task Title](https://app.asana.com/0/123456/789012)'
    );
    expect(result.changesApplied).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(mockFetchTaskTitle).toHaveBeenCalledWith('789012');
  });

  test('should update existing markdown links with correct task titles', async () => {
    mockFetchTaskTitle.mockResolvedValueOnce('Updated Task Title');

    const input = 'Check this task: [Old Title](https://app.asana.com/0/123456/789012)';
    const result = await transformPRBody(input, mockFetchTaskTitle);

    expect(result.body).toBe(
      'Check this task: [Updated Task Title](https://app.asana.com/0/123456/789012)'
    );
    expect(result.changesApplied).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(mockFetchTaskTitle).toHaveBeenCalledWith('789012');
  });

  test('should handle multiple Asana URLs correctly', async () => {
    mockFetchTaskTitle.mockResolvedValueOnce('Task 1');
    mockFetchTaskTitle.mockResolvedValueOnce('Task 2');

    const input =
      'First task: https://app.asana.com/0/123456/111111\nSecond task: https://app.asana.com/0/123456/222222';
    const result = await transformPRBody(input, mockFetchTaskTitle);

    expect(result.body).toBe(
      'First task: [Task 1](https://app.asana.com/0/123456/111111)\nSecond task: [Task 2](https://app.asana.com/0/123456/222222)'
    );
    expect(result.changesApplied).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(mockFetchTaskTitle).toHaveBeenCalledTimes(2);
  });

  test('should handle mixed plain URLs and markdown links', async () => {
    mockFetchTaskTitle.mockResolvedValueOnce('Task 1');
    mockFetchTaskTitle.mockResolvedValueOnce('Task 2');

    const input =
      'First task: https://app.asana.com/0/123456/111111\nSecond task: [Old Title](https://app.asana.com/0/123456/222222)';
    const result = await transformPRBody(input, mockFetchTaskTitle);

    expect(result.body).toBe(
      'First task: [Task 1](https://app.asana.com/0/123456/111111)\nSecond task: [Task 2](https://app.asana.com/0/123456/222222)'
    );
    expect(result.changesApplied).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(mockFetchTaskTitle).toHaveBeenCalledTimes(2);
  });

  test('should handle failure to fetch task titles', async () => {
    mockFetchTaskTitle.mockRejectedValueOnce(new Error('API Error'));

    const input = 'Failed task: https://app.asana.com/0/123456/111111';
    const result = await transformPRBody(input, mockFetchTaskTitle);

    expect(result.body).toBe('Failed task: https://app.asana.com/0/123456/111111');
    expect(result.changesApplied).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(mockFetchTaskTitle).toHaveBeenCalledTimes(1);
  });

  test('should handle complex titles with brackets', async () => {
    mockFetchTaskTitle.mockResolvedValueOnce('Title with [brackets]');

    const input = 'Complex task: https://app.asana.com/0/123456/111111';
    const result = await transformPRBody(input, mockFetchTaskTitle);

    expect(result.body).toBe(
      'Complex task: [Title with (brackets)](https://app.asana.com/0/123456/111111)'
    );
    expect(result.changesApplied).toBe(true);
    expect(result.updatedCount).toBe(1);
  });

  test('should handle the reported bug case with nested brackets', async () => {
    // The exact title from the existing markdown link in the test input
    const complexTitle =
      'Unable to open calling modal with no number in account.[Account with number able to open]';
    mockFetchTaskTitle.mockResolvedValueOnce(complexTitle);

    const input = `## Asana <!-- Required -->

[${complexTitle}](https://app.asana.com/1/7423375154038/project/1179024258554553/task/1209591975229040?focus=true)`;

    const result = await transformPRBody(input, mockFetchTaskTitle);

    // If the link text already matches the task title, we should preserve the original format
    // even with nested brackets for backward compatibility
    expect(result.body).toBe(`## Asana <!-- Required -->

[${complexTitle}](https://app.asana.com/1/7423375154038/project/1179024258554553/task/1209591975229040?focus=true)`);
    expect(result.changesApplied).toBe(true);
    expect(result.updatedCount).toBe(1);
  });

  test('should not modify if existing title is the same as task title', async () => {
    mockFetchTaskTitle.mockResolvedValueOnce('Task Title');

    const input = 'Check this task: [Task Title](https://app.asana.com/0/123456/789012)';
    const result = await transformPRBody(input, mockFetchTaskTitle);

    // Should not count as a change if the title is already correct
    expect(result.body).toBe(
      'Check this task: [Task Title](https://app.asana.com/0/123456/789012)'
    );
    expect(result.changesApplied).toBe(true);
    expect(result.updatedCount).toBe(1);
  });
});
