import JSZip from "jszip";

import { InsightDataset, InsightDatasetKind, InsightError } from "./IInsightFacade";
import Section from "../model/Section";
import SectionsDataset from "../model/SectionsDataset";
import Dataset from "../model/Dataset";

export default class SectionProcessor {
	public async addSectionsDataset(id: string, content: string, kind: InsightDatasetKind): Promise<Dataset> {
		const jszip = new JSZip();

		return new Promise<Dataset>((resolve, reject) => {
			// Load zip content
			jszip
				.loadAsync(content, { base64: true })
				.then(async (zip) => this.pushAllSection(zip, reject))
				.then((allSections) => {
					// Wait until all courses are processed
					Promise.all(allSections)
						.then((coursesResult) => this.pushValidSection(coursesResult))
						.then(async (allValidSections) => {
							// check if the valid sections are empty AFTER all courses have been processed
							if (allValidSections.length === 0) {
								return reject(new InsightError("Not a single valid section found"));
							}

							// Return an InsightDataset with all the valid sections added AFTER all courses have been processed
							const allPrefixedSections = [];
							for (const section of allValidSections) {
								allPrefixedSections.push(section.getPrefixedFields(id) as Section);
							}
							const ds = new SectionsDataset(id, kind, allValidSections.length, allPrefixedSections);
							await this.storeToDisk(ds);
							return resolve(ds);
						})
						.catch((err) => {
							return reject(err);
						});
				})
				.catch((err) => {
					return reject(err);
				});
		});
	}

	private async storeToDisk(ds: SectionsDataset): Promise<void> {
		const fs = require("fs-extra");
		try {
			// Ensure the directory exists
			await fs.ensureDir("./data");

			// Write the dataset's sections to a JSON file
			await fs.writeJson("./data/" + ds.id + ".json", ds.sections);
		} catch (err) {
			throw new InsightError(`Error storing json file to disk: ${err}`);
		}
	}

	private async pushAllSection(zip: JSZip, reject: (error: InsightError) => void): Promise<Promise<string>[]> {
		const allSections: Promise<string>[] = [];
		const coursesFolder = zip.folder(/^courses\/$/);

		// Check if courses folder exists and is at root level
		if (coursesFolder !== null) {
			let numberOfFiles = 0;
			zip.folder("courses")?.forEach(function (_relativePath: string, file: any) {
				numberOfFiles++;
				allSections.push(file.async("string"));
			});

			if (numberOfFiles === 0) {
				reject(new InsightError("courses folder is empty"));
				return Promise.reject();
			}
		} else {
			reject(new InsightError("courses folder not found"));
			return Promise.reject();
		}

		return allSections;
	}

	private pushValidSection(listOfResult: string[]): Section[] {
		const allValidSections: Section[] = [];

		for (const JSONfile of listOfResult) {
			const course = JSON.parse(JSONfile);
			// make sure each result key exists
			if (!Object.prototype.hasOwnProperty.call(course, "result")) {
				continue;
			}
			for (const section of course.result) {
				// If a section has missing field, it is invalid (skip it)
				if (this.missingQueryKey(section)) {
					continue;
				}

				// Set year to 1900 if section == "overall"
				if (Object.prototype.hasOwnProperty.call(section, "Section")) {
					if (section.Section === "overall") {
						section.Year = 1900;
					}
				}

				const validSection = new Section(section);
				allValidSections.push(validSection);
			}
		}

		return allValidSections;
	}

	private missingQueryKey(section: any): boolean {
		if (!Object.prototype.hasOwnProperty.call(section, "Course")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Title")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Professor")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Subject")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Year")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Avg")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Pass")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Fail")) {
			return true;
		}
		if (!Object.prototype.hasOwnProperty.call(section, "Audit")) {
			return true;
		}
		return false;
	}
}
