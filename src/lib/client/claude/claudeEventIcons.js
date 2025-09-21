import IconFileText from '../shared/components/Icons/IconFileText.svelte';
import IconFileCode from '../shared/components/Icons/IconFileCode.svelte';
import IconEdit from '../shared/components/Icons/IconEdit.svelte';
import IconTerminal2 from '../shared/components/Icons/IconTerminal2.svelte';
import IconSearch from '../shared/components/Icons/IconSearch.svelte';
import IconAsterisk from '../shared/components/Icons/IconAsterisk.svelte';
import IconWorld from '../shared/components/Icons/IconWorld.svelte';
import IconChecklist from '../shared/components/Icons/IconChecklist.svelte';
import IconSquareCheck from '../shared/components/Icons/IconSquareCheck.svelte';
import IconReceipt from '../shared/components/Icons/IconReceipt.svelte';
import IconCircleCheck from '../shared/components/Icons/IconCircleCheck.svelte';
import IconTool from '../shared/components/Icons/IconTool.svelte';
import IconHourglassEmpty from '../shared/components/Icons/IconHourglassEmpty.svelte';
import IconBrain from '../shared/components/Icons/IconBrain.svelte';
import IconRobot from '../shared/components/Icons/IconRobot.svelte';
import IconUser from '../shared/components/Icons/IconUser.svelte';
import IconMessage from '../shared/components/Icons/IconMessage.svelte';
import IconDots from '../shared/components/Icons/IconDots.svelte';

// Maps a Claude/Tool event to a Tabler icon component and human label
export function getIconForEvent(event) {
	try {
		const type = (event?.type || '').toString().toLowerCase();

		// Assistant tool_use content
		if (type === 'assistant' && event?.message?.content && Array.isArray(event.message.content)) {
			const toolItems = event.message.content.filter((c) => c && c.type === 'tool_use');
			if (toolItems.length > 0) {
				const toolName = (toolItems[0].name || '').toString().toLowerCase();
				return mapToolName(toolName);
			}
		}

		// User tool_result content
		if (type === 'user' && event?.message?.content) {
			const content = event.message.content;
			const hasToolResult = Array.isArray(content)
				? content.some((c) => c && c.type === 'tool_result')
				: content && typeof content === 'object' && content.type === 'tool_result';
			if (hasToolResult) return { Icon: IconTool, label: 'Tool result' };
		}

		// Direct tool/name mapping
		const tool = (event?.tool || event?.name || '').toString().toLowerCase();
		if (tool) return mapToolName(tool);

		// Generic type-based icons
		if (type === 'summary') return { Icon: IconReceipt, label: 'Summary' };
		if (type === 'result') return { Icon: IconCircleCheck, label: 'Result' };
		if (type === 'tool_result') return { Icon: IconTool, label: 'Tool result' };
		if (type.includes('status') || type.includes('progress'))
			return { Icon: IconHourglassEmpty, label: 'Working' };
		if (type.includes('think') || type.includes('plan'))
			return { Icon: IconBrain, label: 'Thinking' };
		if (type.includes('assistant')) return { Icon: IconRobot, label: 'Assistant' };
		if (type.includes('user')) return { Icon: IconUser, label: 'User' };
		if (type.includes('tool')) return { Icon: IconTool, label: 'Tool' };
		if (type.includes('message')) return { Icon: IconMessage, label: 'Message' };

		return { Icon: IconDots, label: type || 'Event' };
	} catch {
		return { Icon: IconDots, label: 'Event' };
	}
}

function mapToolName(toolName) {
	if (toolName.includes('read')) return { Icon: IconFileText, label: 'Read files' };
	if (toolName.includes('write')) return { Icon: IconFileCode, label: 'Write files' };
	if (toolName.includes('edit')) return { Icon: IconEdit, label: 'Edit files' };
	if (toolName.includes('bash') || toolName.includes('shell') || toolName.includes('exec'))
		return { Icon: IconTerminal2, label: 'Run command' };
	if (toolName.includes('grep') || toolName.includes('search'))
		return { Icon: IconSearch, label: 'Search' };
	if (toolName.includes('glob')) return { Icon: IconAsterisk, label: 'Glob match' };
	if (toolName.includes('web')) return { Icon: IconWorld, label: 'Web' };
	if (toolName.includes('task')) return { Icon: IconChecklist, label: 'Task' };
	if (toolName.includes('todo')) return { Icon: IconSquareCheck, label: 'Todo' };
	return { Icon: IconTool, label: 'Tool' };
}
