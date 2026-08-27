import { z } from "zod";

export const githubRepositoryUrlSchema = z
  .string()
  .trim()
  .url("Enter a complete public GitHub repository URL.")
  .transform((value, context) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
      context.addIssue({ code: "custom", message: "Only https://github.com public repository URLs are supported." });
      return z.NEVER;
    }
    if (url.username || url.password || url.port) {
      context.addIssue({ code: "custom", message: "Repository URLs cannot include credentials or a custom port." });
      return z.NEVER;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) {
      context.addIssue({ code: "custom", message: "Use a repository root URL such as https://github.com/owner/repository." });
      return z.NEVER;
    }
    const owner = segments[0];
    const name = segments[1].replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
      context.addIssue({ code: "custom", message: "The repository owner or name contains unsupported characters." });
      return z.NEVER;
    }
    return { owner, name, url: `https://github.com/${owner}/${name}` };
  });

export type GitHubRepositoryReference = z.infer<typeof githubRepositoryUrlSchema>;
