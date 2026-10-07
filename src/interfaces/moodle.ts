import { z } from "zod";

// Only the fields the tools use are declared; zod drops the rest.
// Most fields are optional because Moodle omits them depending on permissions and site settings.

export const MoodleErrorSchema = z.object({
  exception: z.string().optional(),
  errorcode: z.string(),
  message: z.string(),
});

export const SiteInfoSchema = z.object({
  sitename: z.string(),
  username: z.string(),
  fullname: z.string(),
  userid: z.number(),
  siteurl: z.string(),
  release: z.string().optional(),
});
export type SiteInfo = z.infer<typeof SiteInfoSchema>;

export const TokenResponseSchema = z.object({
  token: z.string(),
  privatetoken: z.string().nullish(),
});

export const CourseSchema = z.object({
  id: z.number(),
  fullname: z.string(),
  shortname: z.string(),
  startdate: z.number().optional(),
  enddate: z.number().optional(),
  progress: z.number().nullish(),
  coursecategory: z.string().optional(),
  viewurl: z.string().optional(),
  isfavourite: z.boolean().optional(),
  hidden: z.boolean().optional(),
});
export type Course = z.infer<typeof CourseSchema>;

export const EnrolledCoursesSchema = z.object({
  courses: z.array(CourseSchema),
  nextoffset: z.number().optional(),
});

export const ModuleContentSchema = z.object({
  type: z.string(),
  filename: z.string(),
  filesize: z.number().optional(),
  fileurl: z.string().optional(),
  mimetype: z.string().optional(),
  timemodified: z.number().nullish(),
});

export const ModuleSchema = z.object({
  id: z.number(),
  name: z.string(),
  modname: z.string(),
  instance: z.number().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  visible: z.number().optional(),
  uservisible: z.boolean().optional(),
  contents: z.array(ModuleContentSchema).optional(),
  dates: z.array(z.object({ label: z.string(), timestamp: z.number() })).optional(),
  completiondata: z.object({ state: z.number() }).optional(),
});
export type Module = z.infer<typeof ModuleSchema>;

export const SectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  section: z.number().optional(),
  summary: z.string().optional(),
  visible: z.number().optional(),
  modules: z.array(ModuleSchema),
});
export const CourseContentsSchema = z.array(SectionSchema);

export const ActionEventSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  modulename: z.string().nullish(),
  instance: z.number().nullish(),
  eventtype: z.string().optional(),
  timestart: z.number(),
  timesort: z.number().optional(),
  overdue: z.boolean().optional(),
  url: z.string().optional(),
  course: z.object({ id: z.number(), fullname: z.string(), shortname: z.string().optional() }).optional(),
  action: z.object({ name: z.string(), url: z.string().optional(), actionable: z.boolean().optional() }).nullish(),
});
export const ActionEventsSchema = z.object({ events: z.array(ActionEventSchema) });

export const FileAttachmentSchema = z.object({
  filename: z.string(),
  fileurl: z.string(),
  filesize: z.number().optional(),
  mimetype: z.string().optional(),
});

export const AssignmentSchema = z.object({
  id: z.number(),
  cmid: z.number(),
  course: z.number(),
  name: z.string(),
  duedate: z.number(),
  cutoffdate: z.number().optional(),
  allowsubmissionsfromdate: z.number().optional(),
  grade: z.number().optional(),
  intro: z.string().optional(),
  introattachments: z.array(FileAttachmentSchema).optional(),
});
export const AssignmentsSchema = z.object({
  courses: z.array(
    z.object({ id: z.number(), fullname: z.string(), assignments: z.array(AssignmentSchema) }),
  ),
});

export const SubmissionStatusSchema = z.object({
  lastattempt: z
    .object({
      submission: z.object({ status: z.string(), timemodified: z.number().optional() }).nullish(),
      teamsubmission: z.object({ status: z.string(), timemodified: z.number().optional() }).nullish(),
      gradingstatus: z.string().optional(),
      caneditowner: z.boolean().optional(),
      cansubmit: z.boolean().optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
  feedback: z
    .object({
      gradefordisplay: z.string().optional(),
      gradeddate: z.number().optional(),
      plugins: z
        .array(
          z.object({
            type: z.string(),
            editorfields: z.array(z.object({ name: z.string(), text: z.string() })).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const GradeItemSchema = z.object({
  itemname: z.string().nullish(),
  itemtype: z.string(),
  itemmodule: z.string().nullish(),
  gradeformatted: z.string().optional(),
  grademax: z.number().optional(),
  percentageformatted: z.string().optional(),
  feedback: z.string().optional(),
});
export const GradeItemsSchema = z.object({
  usergrades: z.array(
    z.object({ courseid: z.number(), gradeitems: z.array(GradeItemSchema) }),
  ),
});
export const CourseGradesSchema = z.object({
  grades: z.array(z.object({ courseid: z.number(), grade: z.string().optional() })),
});

export const NotificationsSchema = z.object({
  notifications: z.array(
    z.object({
      id: z.number(),
      subject: z.string(),
      smallmessage: z.string().optional(),
      text: z.string().optional(),
      contexturl: z.string().nullish(),
      timecreated: z.number(),
      read: z.boolean(),
    }),
  ),
  unreadcount: z.number(),
});

export const ForumDiscussionsSchema = z.object({
  discussions: z.array(
    z.object({
      discussion: z.number(),
      name: z.string(),
      message: z.string().optional(),
      userfullname: z.string().optional(),
      created: z.number().optional(),
      timemodified: z.number().optional(),
      numreplies: z.number().optional(),
      pinned: z.boolean().optional(),
    }),
  ),
});

export const DiscussionPostsSchema = z.object({
  posts: z.array(
    z.object({
      id: z.number(),
      subject: z.string(),
      message: z.string(),
      timecreated: z.number(),
      author: z.object({ fullname: z.string().optional() }).optional(),
      attachments: z.array(FileAttachmentSchema.partial({ fileurl: true })).optional(),
    }),
  ),
});

export const PagesSchema = z.object({
  pages: z.array(
    z.object({
      coursemodule: z.number(),
      course: z.number(),
      name: z.string(),
      intro: z.string().optional(),
      content: z.string(),
    }),
  ),
});
