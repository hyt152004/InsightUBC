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
				.then((zip) => {
					const coursesFolder = zip.folder(/^courses\/$/);
					const coursesList: Promise<string>[] = [];
					let allValidSections: Section[] = [];

					// Check if courses folder exists and is at root level
					if (coursesFolder !== null) {
						let numberOfFiles = 0;
						zip.folder("courses")?.forEach(function (relativePath: string, file: any) {
							numberOfFiles++;
							coursesList.push(file.async("string"));
						});

						if (numberOfFiles === 0) {
							return reject(new InsightError("courses folder is empty"));
						}
					} else {
						return reject(new InsightError("courses folder not found"));
					}

					// Wait until all courses are processed
					Promise.all(coursesList)
						.then((coursesResult) => {
							// Validate each section of each course
							for (const JSONfile of coursesResult) {
								const course = JSON.parse(JSONfile);
								for (const section of course["result"]) {
									// If a section has missing field, it is invalid (skip it)
									if (!section.hasOwnProperty("Course")) {
										continue;
									}
									if (!section.hasOwnProperty("Title")) {
										continue;
									}
									if (!section.hasOwnProperty("Professor")) {
										continue;
									}
									if (!section.hasOwnProperty("Subject")) {
										continue;
									}
									if (!section.hasOwnProperty("Year")) {
										continue;
									}
									if (!section.hasOwnProperty("Avg")) {
										continue;
									}
									if (!section.hasOwnProperty("Pass")) {
										continue;
									}
									if (!section.hasOwnProperty("Fail")) {
										continue;
									}
									if (!section.hasOwnProperty("Audit")) {
										continue;
									}
									const validSection = new Section(section);
									allValidSections.push(validSection);
								}
							}

							// check if the valid sections are empty AFTER all courses have been processed
							if (allValidSections.length === 0) {
								return reject(new InsightError("Not a single valid section found"));
							}

							// Return an InsightDataset with all the valid sections added AFTER all courses have been processed
							let ds = new SectionsDataset(id, kind, allValidSections.length, allValidSections);
							return resolve(ds);
						})
						.catch((err) => {
							return reject(new InsightError("Error processsing courses"));
						});
				})
				.catch((err) => {
					return reject(new InsightError("Error unzipping content"));
				});
		});
	}
}
