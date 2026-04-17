/**
 * Auto-syncs pi's light/dark theme with the system appearance.
 *
 * Supported detection:
 * - macOS
 * - GNOME/GTK on Linux
 * - Windows
 *
 * Optional env vars:
 * - PI_SYSTEM_DARK_THEME   (default: "dark")
 * - PI_SYSTEM_LIGHT_THEME  (default: "light")
 * - PI_SYSTEM_THEME_POLL_MS (default: 2000)
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const execFileAsync = promisify(execFile);

type SystemTheme = "dark" | "light";

const DARK_THEME = process.env.PI_SYSTEM_DARK_THEME?.trim() || "dark";
const LIGHT_THEME = process.env.PI_SYSTEM_LIGHT_THEME?.trim() || "light";
const POLL_MS = Math.max(500, Number.parseInt(process.env.PI_SYSTEM_THEME_POLL_MS ?? "2000", 10) || 2000);

let timer: ReturnType<typeof setTimeout> | null = null;
let sessionToken = 0;

async function run(command: string, args: string[]): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync(command, args);
		return String(stdout).trim();
	} catch {
		return null;
	}
}

async function detectMacTheme(): Promise<SystemTheme | null> {
	const output = await run("osascript", [
		"-e",
		"tell application \"System Events\" to tell appearance preferences to return dark mode",
	]);

	if (output === null) {
		return null;
	}

	return output.toLowerCase() === "true" ? "dark" : "light";
}

async function detectLinuxTheme(): Promise<SystemTheme | null> {
	const colorScheme = await run("gsettings", ["get", "org.gnome.desktop.interface", "color-scheme"]);
	if (colorScheme) {
		const normalized = colorScheme.toLowerCase();
		if (normalized.includes("prefer-dark")) {
			return "dark";
		}
		if (normalized.includes("prefer-light")) {
			return "light";
		}
	}

	const gtkTheme = await run("gsettings", ["get", "org.gnome.desktop.interface", "gtk-theme"]);
	if (gtkTheme) {
		return gtkTheme.toLowerCase().includes("dark") ? "dark" : "light";
	}

	return null;
}

async function detectWindowsTheme(): Promise<SystemTheme | null> {
	const output = await run("powershell", [
		"-NoProfile",
		"-Command",
		"(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize').AppsUseLightTheme",
	]);

	if (output === null) {
		return null;
	}

	const value = Number.parseInt(output, 10);
	if (Number.isNaN(value)) {
		return null;
	}

	return value === 0 ? "dark" : "light";
}

async function detectSystemTheme(): Promise<SystemTheme | null> {
	switch (process.platform) {
		case "darwin":
			return detectMacTheme();
		case "linux":
			return detectLinuxTheme();
		case "win32":
			return detectWindowsTheme();
		default:
			return null;
	}
}

function stopWatching() {
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
	sessionToken += 1;
}

async function applyTheme(theme: SystemTheme, ctx: ExtensionContext, announce = false): Promise<boolean> {
	const themeName = theme === "dark" ? DARK_THEME : LIGHT_THEME;
	const result = ctx.ui.setTheme(themeName);

	if (!result.success) {
		if (announce) {
			ctx.ui.notify(`Theme sync failed: ${result.error}`, "error");
		}
		return false;
	}

	return true;
}

function startWatching(ctx: ExtensionContext) {
	stopWatching();
	const token = sessionToken;

	const tick = async () => {
		const detected = await detectSystemTheme();
		if (token !== sessionToken) {
			return;
		}

		if (detected && ctx.ui.theme.name !== (detected === "dark" ? DARK_THEME : LIGHT_THEME)) {
			await applyTheme(detected, ctx);
		}

		if (token !== sessionToken) {
			return;
		}

		timer = setTimeout(() => {
			void tick();
		}, POLL_MS);
	};

	void tick();
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		startWatching(ctx);
	});

	pi.on("session_shutdown", async () => {
		stopWatching();
	});
}
