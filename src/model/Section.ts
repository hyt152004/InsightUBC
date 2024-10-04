export default class Section {
	private uuid: string;
	private id: string;
	private title: string;
	private instructor: string;
	private dept: string;
	private year: number;
	private avg: number;
	private pass: number;
	private fail: number;
	private audit: number;

	constructor(data: any) {
		this.uuid = data.id;
		this.id = data.Course;
		this.title = data.Title;
		this.instructor = data.Professor;
		this.dept = data.Subject;
		this.year = data.Year;
		this.avg = data.Avg;
		this.pass = data.Pass;
		this.fail = data.Fail;
		this.audit = data.Audit;
	}

	public getPrefixedFields(id: string): Record<string, any> {
		const prefix = id + "_";
		return {
			[prefix + "uuid"]: this.uuid,
			[prefix + "id"]: this.id,
			[prefix + "title"]: this.title,
			[prefix + "instructor"]: this.instructor,
			[prefix + "dept"]: this.dept,
			[prefix + "year"]: this.year,
			[prefix + "avg"]: this.avg,
			[prefix + "pass"]: this.pass,
			[prefix + "fail"]: this.fail,
			[prefix + "audit"]: this.audit,
		};
	}
}
