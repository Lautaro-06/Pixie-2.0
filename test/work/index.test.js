const { initializeWorkMode, activateAgent, deactivateAgent, getActiveAgents } = require('../../src/main/work/index');

describe('Work Mode Core', () => {
    beforeAll(() => {
        initializeWorkMode();
    });

    test('should load agents', () => {
        const agents = getActiveAgents();
        expect(agents).toBeInstanceOf(Array);
    });

    test('should activate an agent', () => {
        activateAgent('programador');
        const agents = getActiveAgents();
        expect(agents.some(agent => agent.id === 'programador')).toBe(true);
    });

    test('should deactivate an agent', () => {
        deactivateAgent('programador');
        const agents = getActiveAgents();
        expect(agents.some(agent => agent.id === 'programador')).toBe(false);
    });
});
