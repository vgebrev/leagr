import path from 'path';
import fs from 'fs/promises';
import { isObject } from '$lib/helpers.js';

const dataPath = path.join(process.cwd(), 'data');

async function get(key, date) {
	const filename = date?.match(/^\d{4}-\d{2}-\d{2}/) ? date : null;
	if (!filename) {
		console.warn(`${date} is not a valid date`);
		return null;
	}

	try {
		const filePath = path.join(dataPath, `${filename}.json`);
		const file = await fs.readFile(filePath, 'utf-8');
		const data = JSON.parse(file);
		return data[key];
	} catch (err) {
		console.error('Error reading file:', err);
		return null;
	}
}

async function set(key, date, value, defaultValue = []) {
	const filename = date?.match(/^\d{4}-\d{2}-\d{2}/) ? date : null;
	if (!filename) {
		console.warn(`${date} is not a valid date`);
		return false;
	}

	try {
		const filePath = path.join(dataPath, `${filename}.json`);
		let jsonData = {};
		try {
			const file = await fs.readFile(filePath, 'utf-8');
			jsonData = JSON.parse(file);
		} catch (ex) {
			console.warn(`File ${filePath} not found or empty, creating a new one.`, ex);
		}
		if (!jsonData[key]) {
			jsonData[key] = defaultValue;
		}
		if (Array.isArray(jsonData[key])) {
			jsonData[key].push(value);
		} else if (isObject(jsonData[key])) {
			jsonData[key] = { ...(jsonData[key] ?? {}), ...value };
		} else {
			jsonData[key] = value;
		}
		await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
		return true;
	} catch (err) {
		console.error('Error writing file: ', err);
		return false;
	}
}
async function remove(key, date, value) {
	const filename = date?.match(/^\d{4}-\d{2}-\d{2}/) ? date : null;
	if (!filename) {
		console.warn(`${date} is not a valid date`);
		return false;
	}

	try {
		const filePath = path.join(dataPath, `${filename}.json`);
		let jsonData = {};
		try {
			const file = await fs.readFile(filePath, 'utf-8');
			jsonData = JSON.parse(file);
		} catch (ex) {
			console.warn(`File ${filePath} not found or empty, creating a new one.`, ex);
		}
		if (!jsonData[key]) {
			return true;
		}
		if (Array.isArray(jsonData[key])) {
			jsonData[key] = jsonData[key].filter((item) => item !== value);
		} else if (isObject(jsonData[key])) {
			delete jsonData[key][value];
		} else {
			jsonData[key] = null;
		}
		await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
		return true;
	} catch (err) {
		console.error('Error writing file:', err);
		return false;
	}
}
export const data = {
	get,
	set,
	remove
};
