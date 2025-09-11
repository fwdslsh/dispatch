export function formatClaudeEventSummary(event) {
	if (!event) return '';
	try {
		const type = (event.type || 'Unknown').toString();
		let summary = `<strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>`;

		if (type === 'message') {
			const role = event.role || 'unknown';
			const content = event.content || [];
			summary += ` <span class="event-role">[${role}]</span>`;
			if (Array.isArray(content)) {
				content.forEach((item) => {
					if (item.type === 'tool_use') {
						summary += `<br><strong>🛠️ Tool:</strong> ${item.name || 'unknown'}`;
						if (item.input && Object.keys(item.input).length > 0) {
							const inputKeys = Object.keys(item.input).slice(0, 3);
							summary += `<br><strong>Input:</strong> ${inputKeys.join(', ')}${inputKeys.length < Object.keys(item.input).length ? '...' : ''}`;
						}
					} else if (item.type === 'text' && item.text) {
						const preview = item.text.substring(0, 80);
						summary += `<br><strong>💬 Text:</strong> ${preview}${item.text.length > 80 ? '...' : ''}`;
					} else if (item.type === 'tool_result') {
						summary += `<br><strong>📊 Result:</strong> ${item.tool_use_id ? `for ${item.tool_use_id}` : 'available'}`;
						if (item.content) {
							const preview = typeof item.content === 'string' ? item.content.substring(0, 60) : JSON.stringify(item.content).substring(0, 60);
							summary += `<br><span class="event-preview">${preview}${preview.length >= 60 ? '...' : ''}</span>`;
						}
					}
				});
			}
		} else if (type === 'tool_use') {
			const toolName = event.name || event.tool || 'unknown';
			summary += `<br><strong>🛠️ Tool:</strong> ${toolName}`;
			if (event.input) {
				const inputStr = typeof event.input === 'object' ? JSON.stringify(event.input) : event.input.toString();
				const preview = inputStr.substring(0, 100);
				summary += `<br><strong>Input:</strong> ${preview}${inputStr.length > 100 ? '...' : ''}`;
			}
		} else if (type === 'tool_result') {
			summary += `<br><strong>📊 Tool Result</strong>`;
			if (event.tool_use_id) summary += ` <span class="event-id">${event.tool_use_id.substring(0, 8)}...</span>`;
			if (event.content) {
				const contentStr = typeof event.content === 'string' ? event.content : JSON.stringify(event.content);
				const preview = contentStr.substring(0, 100);
				summary += `<br><span class="event-preview">${preview}${contentStr.length > 100 ? '...' : ''}</span>`;
			}
		} else if (type === 'result') {
			if (event.result) {
				const preview = event.result.substring(0, 150);
				summary += `<br><strong>✅ Final Response:</strong><br><span class="event-preview">${preview}${event.result.length > 150 ? '...' : ''}</span>`;
			}
		} else {
			const tool = event.tool || event.name || '';
			if (tool) summary += ` - <strong>${tool}</strong>`;
			if (event.input) {
				const inputStr = typeof event.input === 'object' ? JSON.stringify(event.input) : event.input.toString();
				const preview = inputStr.substring(0, 80);
				summary += `<br><strong>Input:</strong> ${preview}${inputStr.length > 80 ? '...' : ''}`;
			}
			if (event.result) {
				const resultStr = typeof event.result === 'object' ? JSON.stringify(event.result) : event.result.toString();
				const preview = resultStr.substring(0, 80);
				summary += `<br><strong>Result:</strong> ${preview}${resultStr.length > 80 ? '...' : ''}`;
			}
		}
		return summary;
	} catch (err) {
		return 'Event details unavailable';
	}
}

