export function findAllInstancesWithTagnameUsingChildNodes(nodes: any, tagName: string): any[] {
	const result = [];
	for (const node of nodes) {
		for (const child of node.childNodes) {
			if (child.tagName === tagName) {
				result.push(child);
			}
		}
	}

	return result;
}

export function findAllInstancesThatIncludeUsingAttrs(nodes: any, includeString: string): any[] {
	const result = [];

	for (const node of nodes) {
		for (const child of node.attrs) {
			if (child.value.includes(includeString)) {
				result.push(node);
			}
		}
	}

	return result;
}

export function findAllInstancesWithTagnameUsingAttrs(nodes: any, includeString: string): any[] {
	const result = [];
	for (const node of nodes) {
		for (const child of node.attrs) {
			if (child.name === includeString) {
				result.push(child.value);
			}
		}
	}

	return result;
}

export function isValidIndexTable(indexTable: any): boolean {
	// must have either:
	// views-field-title
	// views-field-field-building-code
	// views-field-field-building-address
	try {
		if (indexTable.tagName === "td" && indexTable.attrs[0].value.includes("views-field")) {
			return true;
		}
	} catch {
		return false;
	}

	if (indexTable.childNodes && indexTable.childNodes.length > 0) {
		for (const child of indexTable.childNodes) {
			const found = isValidIndexTable(child);
			if (found) {
				return found;
			}
		}
	}
	return false;
}

export function isValidBuildingTable(buildingTable: any): boolean {
	// must have either:
	// views-field
	// views-field-field-room-number
	// views-field-field-room-capacity
	// views-field-field-room-type
	// views-field-field-room-furniture
	try {
		if (buildingTable.tagName === "td" && buildingTable.attrs[0].value.includes("views-field")) {
			// TODO: maybe we should check for all valid classes?
			return true;
		}
	} catch {
		return false;
	}

	if (buildingTable.childNodes && buildingTable.childNodes.length > 0) {
		for (const child of buildingTable.childNodes) {
			const found = isValidBuildingTable(child);
			if (found) {
				return found;
			}
		}
	}
	return false;
}
