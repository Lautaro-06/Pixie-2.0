import React, { useState, useEffect } from 'react';
import memory from '../../main/memory';

export default function WorkSettings() {
    const [activeAgents, setActiveAgents] = useState([]);

    useEffect(() => {
        setActiveAgents(memory.get('work.activeAgents') || []);
    }, []);

    const toggleAgent = (agentId) => {
        const updatedAgents = activeAgents.includes(agentId)
            ? activeAgents.filter(id => id !== agentId)
            : [...activeAgents, agentId];
        setActiveAgents(updatedAgents);
        memory.set('work.activeAgents', updatedAgents);
    };

    return (
        <div>
            <h2>Modo Trabajo</h2>
            <p>Activá o desactivá agentes según tu flujo de trabajo.</p>
            <label>
                <input
                    type="checkbox"
                    checked={activeAgents.includes('programador')}
                    onChange={() => toggleAgent('programador')}
                />
                Agente Programador
            </label>
        </div>
    );
}
