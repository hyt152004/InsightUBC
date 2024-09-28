import JSZip from "jszip";
import { InsightDataset, InsightDatasetKind, InsightError } from "./IInsightFacade";
import Log from "../../util/Log";
import Section from "../model/Section";
import SectionsDataset from "../model/SectionsDataset";

export default class DatasetProcessor {
	public async addSectionsDataset(id: string, content: string, kind: InsightDatasetKind): Promise<InsightDataset> {
		const jszip = new JSZip();
		let fs = require("fs-extra");

		return new Promise<InsightDataset>((resolve, reject) => {
			//TODO: Split codes into helper functions (function cannot exceed 35 lines)

			// Load zip content
			jszip
				.loadAsync(content, { base64: true })
				.then((zip) => this.pushAllSection(zip, reject))
				.then((allSections) => {
					// Wait until all courses are processed
					Promise.all(allSections)
						.then((coursesResult) => this.pushValidSection(coursesResult))
						.then((allValidSections) => {
							// check if the valid sections are empty AFTER all courses have been processed
							if (allValidSections.length === 0) {
								return reject(new InsightError("Not a single valid section found"));
							}

							// Return an InsightDataset with all the valid sections added AFTER all courses have been processed
							let ds = new SectionsDataset(id, kind, allValidSections.length, allValidSections);
							return resolve(ds);
						})
						.catch((err) => {
							return err;
						});
				})
				.catch((err) => {
					return err;
				});
		});
	}

	private async pushAllSection(zip: JSZip, reject: (error: InsightError) => void): Promise<Promise<string>[]> {
		const allSections: Promise<string>[] = [];
		const coursesFolder = zip.folder(/^courses\/$/);

		// Check if courses folder exists and is at root level
		if (coursesFolder !== null) {
			let numberOfFiles = 0;
			zip.folder("courses")?.forEach(function (relativePath: string, file: any) {
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
			if (!course.hasOwnProperty("result")) {
				continue;
			}
			for (const section of course["result"]) {
				// If a section has missing field, it is invalid (skip it)
				if (this.missingQueryKey(section)) {
					continue;
				}
				const validSection = new Section(section);
				allValidSections.push(validSection);
			}
		}

		return allValidSections;
	}

	private missingQueryKey(section: any): boolean {
		if (!section.hasOwnProperty("Course")) {
			return true;
		}
		if (!section.hasOwnProperty("Title")) {
			return true;
		}
		if (!section.hasOwnProperty("Professor")) {
			return true;
		}
		if (!section.hasOwnProperty("Subject")) {
			return true;
		}
		if (!section.hasOwnProperty("Year")) {
			return true;
		}
		if (!section.hasOwnProperty("Avg")) {
			return true;
		}
		if (!section.hasOwnProperty("Pass")) {
			return true;
		}
		if (!section.hasOwnProperty("Fail")) {
			return true;
		}
		if (!section.hasOwnProperty("Audit")) {
			return true;
		}
		return false;
	}
}
