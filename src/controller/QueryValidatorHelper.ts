export function hasWHEREAndOPTIONS(topLevelKeys: any[]): boolean {
	// Check if topLevelKeys include WHERE and OPTIONS
	const maxTopLevelKeys = 3;
	if (topLevelKeys.length === maxTopLevelKeys - 1) {
		if (!topLevelKeys.includes("WHERE") || !topLevelKeys.includes("OPTIONS")) {
			return false;
		}
	} else if (topLevelKeys.length === maxTopLevelKeys) {
		if (
			!topLevelKeys.includes("WHERE") ||
			!topLevelKeys.includes("OPTIONS") ||
			!topLevelKeys.includes("TRANSFORMATIONS")
		) {
			return false;
		}
	} else {
		return false;
	}
	return true;
}

export function isValidWildCard(wildcard: string): boolean {
	if (wildcard.length === 0) {
		return true;
	}

	const startsWithAsterisk = wildcard[0] === "*";
	const endsWithAsterisk = wildcard[wildcard.length - 1] === "*";

	for (let i = startsWithAsterisk ? 1 : 0; i < (endsWithAsterisk ? wildcard.length - 1 : wildcard.length); i++) {
		if (wildcard[i] === "*") {
			return false;
		}
	}

	return true;
}

// Validity Functions
export function invalidKey(key: string): boolean {
	if (key === null || key.trim() === "" || key.includes("_")) {
		return true;
	}

	return false;
}

export function getValidSectionMkeyHelper(Mkey: string): string {
	const mkey = Mkey.split("_")[1];
	if (mkey === "avg" || mkey === "pass" || mkey === "fail" || mkey === "audit" || mkey === "year") {
		return mkey;
	}
	return "";
}

export function getValidRoomMkeyHelper(Mkey: string): string {
	const mkey = Mkey.split("_")[1];
	if (mkey === "lat" || mkey === "lon" || mkey === "seats") {
		return mkey;
	}
	return "";
}

export function getValidSectionSkeyHelper(Skey: string): string {
	const skey = Skey.split("_")[1];
	if (skey === "dept" || skey === "id" || skey === "instructor" || skey === "title" || skey === "uuid") {
		return skey;
	}
	return "";
}

export function getValidRoomSkeyHelper(Skey: string): string {
	const skey = Skey.split("_")[1];
	if (skey === "fullname" || skey === "shortname" || skey === "number" || skey === "name") {
		return skey;
	}
	if (skey === "address" || skey === "type" || skey === "furniture" || skey === "href") {
		return skey;
	}
	return "";
}

export function isValidSort(sort: any, columns: any): boolean {
	// Single Column
	if (typeof sort === "string") {
		// At this point, we are guaranteed all column keys are valid
		if (!columns.includes(sort)) {
			return false;
		}
	} else {
		const sortKeys = Object.keys(sort);
		const sortBodyLength = 2;
		if (sortKeys.length !== sortBodyLength || !sortKeys.includes("dir") || !sortKeys.includes("keys")) {
			return false;
		}

		if (sortKeys[0] !== "dir" && sortKeys[1] !== "keys") {
			return false;
		}

		if (sort.dir !== "UP" && sort.dir !== "DOWN") {
			return false;
		}

		if (!Array.isArray(sort.keys) || sort.keys.length === 0) {
			return false;
		}

		for (const key of sort.keys) {
			if (!columns.includes(key)) {
				return false;
			}
		}
	}

	return true;
}

export function setDatasetKindHelper(column: string): string {
	if (column.includes("fullname") || column.includes("shortname") || column.includes("number")) {
		return "roomKind";
	} else if (column.includes("address") || column.includes("lat") || column.includes("lon")) {
		return "roomKind";
	} else if (column.includes("href") || column.includes("name")) {
		return "roomKind";
	} else if (column.includes("seats") || column.includes("type") || column.includes("furniture")) {
		return "roomKind";
	} else if (column.includes("avg") || column.includes("pass") || column.includes("fail") || column.includes("audit")) {
		return "sectionKind";
	} else if (
		column.includes("year") ||
		column.includes("dept") ||
		column.includes("id") ||
		column.includes("instructor")
	) {
		return "sectionKind";
	} else if (column.includes("title") || column.includes("uuid")) {
		return "sectionKind";
	}
	return "";
}
