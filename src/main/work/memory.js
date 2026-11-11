const fs = require('fs');
const path = require('path');

const memoryPath = path.join(process.env.APPDATA, 'Pixie', 'work-memory.json');

class Memory {
    constructor() {
        this.data = this.loadMemory();
    }

    loadMemory() {
        if (fs.existsSync(memoryPath)) {
            return JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
        }
        return { activeAgents: [] };
    }

    saveActiveAgents(activeAgents) {
        this.data.activeAgents = activeAgents;
        this.saveMemory();
    }

    saveMemory() {
        fs.writeFileSync(memoryPath, JSON.stringify(this.data, null, 2));
    }
}

module.exports = new Memory();
