class Permissions {
    constructor() {
        this.permissions = {};
    }

    setPermission(agentId, connectorId, permission) {
        if (!this.permissions[agentId]) {
            this.permissions[agentId] = {};
        }
        this.permissions[agentId][connectorId] = permission;
    }

    getPermission(agentId, connectorId) {
        return this.permissions[agentId]?.[connectorId] || 'lectura';
    }
}

module.exports = new Permissions();
