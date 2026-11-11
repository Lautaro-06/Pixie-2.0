const workMode = require('../src/main/work/index');

describe('WorkMode', () => {
    beforeAll(() => {
        workMode.loadAgents();
        workMode.loadMemory();
    });

    test('should load agents', () => {
        expect(workMode.agents.length).toBeGreaterThan(0);
    });

    test('should activate and deactivate agents', () => {
        workMode.activateAgent('programador');
        expect(workMode.activeAgents.some(agent => agent.id === 'programador')).toBe(true);

        workMode.deactivateAgent('programador');
        expect(workMode.activeAgents.some(agent => agent.id === 'programador')).toBe(false);
    });

    test('should save and load memory', () => {
        workMode.memory.testKey = 'testValue';
        workMode.saveMemory();
        workMode.memory = {};
        workMode.loadMemory();
        expect(workMode.memory.testKey).toBe('testValue');
    });
});
