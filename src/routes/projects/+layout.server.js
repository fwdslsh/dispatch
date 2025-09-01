// No special server-side data needed for projects
export async function load() {
    return {
        terminalKey: process.env.TERMINAL_KEY || 'test'
    };
}