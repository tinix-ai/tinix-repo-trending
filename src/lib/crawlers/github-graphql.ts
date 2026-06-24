/* eslint-disable @typescript-eslint/no-explicit-any */
import { githubPool } from "./github-pool";
import { proxyManager } from "./proxy";

export interface GraphQLRepoResult {
  owner: string;
  name: string;
  exists: boolean;
  data?: {
    name: string;
    fullName: string;
    description: string | null;
    homepageUrl: string | null;
    sourceUrl: string;
    primaryLanguage: string | null;
    license: string | null;
    ownerName: string;
    ownerAvatarUrl: string;
    ownerType: 'user' | 'org';
    topics: string[];
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    sourceCreatedAt: Date;
    sourceUpdatedAt: Date;
    location: string | null;
    email: string | null;
    blog: string | null;
    company: string | null;
  };
}

export interface GraphQLSingleRepoResult {
  exists: boolean;
  data?: {
    name: string;
    fullName: string;
    description: string | null;
    homepageUrl: string | null;
    sourceUrl: string;
    primaryLanguage: string | null;
    license: string | null;
    ownerName: string;
    ownerAvatarUrl: string;
    ownerType: 'user' | 'org';
    topics: string[];
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    sourceCreatedAt: Date;
    sourceUpdatedAt: Date;
    location: string | null;
    email: string | null;
    blog: string | null;
    company: string | null;
    readmeText: string | null;
    readmeSha: string | null;
  };
}

export interface GraphQLSearchResult {
  endCursor: string | null;
  hasNextPage: boolean;
  nodes: {
    owner: string;
    name: string;
    stars: number;
  }[];
}

/**
 * Reusable helper to run a GitHub GraphQL query with token rotation and proxy rotation.
 */
async function runGraphQLQuery(
  query: string,
  variables?: Record<string, any>
): Promise<any> {
  let maxRetries = 5;
  while (maxRetries > 0) {
    let currentToken: string | null = null;
    try {
      currentToken = await githubPool.getAvailableToken();
    } catch (err) {
      const error = err as Error;
      if (error.message?.includes("ALL tokens are currently exhausted")) {
        throw err;
      }
      throw err;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "TiniX-Repo-Trending",
    };

    if (currentToken) {
      headers["Authorization"] = `Bearer ${currentToken}`;
    }

    const dispatcher = proxyManager.getRandomDispatcher();
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    };

    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    try {
      const response = await fetch("https://api.github.com/graphql", fetchOptions);
      const reset = response.headers.get("x-ratelimit-reset");

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          if (currentToken) {
            await githubPool.markTokenExhausted(currentToken, reset);
            console.log(`[GraphQL API] 403/429 status. Rotated token. Retries left: ${maxRetries - 1}`);
            maxRetries--;
            continue;
          }
        }
        throw new Error(`GitHub GraphQL API Error: ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as {
        errors?: Array<{ message: string }>;
        data?: Record<string, any>;
      };
      
      if (body.errors && !body.data) {
        throw new Error(`GraphQL Errors: ${JSON.stringify(body.errors)}`);
      }

      return body.data || {};
    } catch (err) {
      console.warn(`[GraphQL API] Retry ${6 - maxRetries} failed:`, err);
      maxRetries--;
      if (maxRetries === 0) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Failed to execute GraphQL query after retries.");
}

/**
 * Executes a batched GraphQL query to retrieve info for up to 100 GitHub repositories at once.
 */
export async function fetchGitHubBatch(
  repos: { owner: string; name: string }[]
): Promise<GraphQLRepoResult[]> {
  if (repos.length === 0) return [];
  if (repos.length > 100) {
    throw new Error("Batch size exceeds limit of 100 repositories");
  }

  // Construct the GraphQL query dynamically using aliases
  let queryFields = "";
  repos.forEach((repo, index) => {
    const ownerEscaped = JSON.stringify(repo.owner);
    const nameEscaped = JSON.stringify(repo.name);

    queryFields += `
      repo_${index}: repository(owner: ${ownerEscaped}, name: ${nameEscaped}) {
        name
        nameWithOwner
        description
        homepageUrl
        url
        primaryLanguage {
          name
        }
        licenseInfo {
          spdxId
          name
        }
        repositoryTopics(first: 10) {
          nodes {
            topic {
              name
            }
          }
        }
        stargazerCount
        forkCount
        watchers {
          totalCount
        }
        issues(states: [OPEN]) {
          totalCount
        }
        createdAt
        pushedAt
        owner {
          login
          avatarUrl
          __typename
          ... on User {
            location
            email
            websiteUrl
            company
          }
          ... on Organization {
            location
            email
            websiteUrl
          }
        }
      }
    `;
  });

  const query = `query { ${queryFields} }`;
  const data = await runGraphQLQuery(query);

  const results: GraphQLRepoResult[] = repos.map((repo, index) => {
    const repoData = data[`repo_${index}`];
    if (!repoData) {
      return {
        owner: repo.owner,
        name: repo.name,
        exists: false,
      };
    }

    const topics = (repoData.repositoryTopics?.nodes || [])
      .map((n: { topic?: { name?: string } }) => n.topic?.name)
      .filter((name?: string): name is string => Boolean(name));

    const ownerType = repoData.owner?.__typename?.toLowerCase() === "organization" ? "org" : "user";

    return {
      owner: repo.owner,
      name: repo.name,
      exists: true,
      data: {
        name: repoData.name,
        fullName: repoData.nameWithOwner,
        description: repoData.description || null,
        homepageUrl: repoData.homepageUrl || null,
        sourceUrl: repoData.url,
        primaryLanguage: repoData.primaryLanguage?.name || null,
        license: repoData.licenseInfo?.spdxId || repoData.licenseInfo?.name || null,
        ownerName: repoData.owner?.login,
        ownerAvatarUrl: repoData.owner?.avatarUrl || "",
        ownerType,
        topics,
        stars: repoData.stargazerCount || 0,
        forks: repoData.forkCount || 0,
        watchers: repoData.watchers?.totalCount || 0,
        openIssues: repoData.issues?.totalCount || 0,
        sourceCreatedAt: new Date(repoData.createdAt),
        sourceUpdatedAt: new Date(repoData.pushedAt || repoData.createdAt),
        location: repoData.owner?.location || null,
        email: repoData.owner?.email || null,
        blog: repoData.owner?.websiteUrl || null,
        company: repoData.owner?.company || null,
      },
    };
  });

  return results;
}

/**
 * Fetches data for a single GitHub repository using GraphQL, including the README.
 */
export async function fetchSingleGitHubRepo(
  owner: string,
  name: string
): Promise<GraphQLSingleRepoResult> {
  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        name
        nameWithOwner
        description
        homepageUrl
        url
        primaryLanguage {
          name
        }
        licenseInfo {
          spdxId
          name
        }
        repositoryTopics(first: 10) {
          nodes {
            topic {
              name
            }
          }
        }
        stargazerCount
        forkCount
        watchers {
          totalCount
        }
        issues(states: [OPEN]) {
          totalCount
        }
        createdAt
        pushedAt
        owner {
          login
          avatarUrl
          __typename
          ... on User {
            location
            email
            websiteUrl
            company
          }
          ... on Organization {
            location
            email
            websiteUrl
          }
        }
        readmeMd: object(expression: "HEAD:README.md") {
          ... on Blob {
            text
            oid
          }
        }
        readmeLower: object(expression: "HEAD:readme.md") {
          ... on Blob {
            text
            oid
          }
        }
        readmeRst: object(expression: "HEAD:README.rst") {
          ... on Blob {
            text
            oid
          }
        }
        readmeTxt: object(expression: "HEAD:README.txt") {
          ... on Blob {
            text
            oid
          }
        }
      }
    }
  `;

  const data = await runGraphQLQuery(query, { owner, name });
  const repoData = data.repository;
  if (!repoData) {
    return { exists: false };
  }

  const topics = (repoData.repositoryTopics?.nodes || [])
    .map((n: { topic?: { name?: string } }) => n.topic?.name)
    .filter((name?: string): name is string => Boolean(name));

  const ownerType = repoData.owner?.__typename?.toLowerCase() === "organization" ? "org" : "user";
  
  const readmeObj = repoData.readmeMd || repoData.readmeLower || repoData.readmeRst || repoData.readmeTxt;
  const readmeText = readmeObj?.text || null;
  const readmeSha = readmeObj?.oid || null;

  return {
    exists: true,
    data: {
      name: repoData.name,
      fullName: repoData.nameWithOwner,
      description: repoData.description || null,
      homepageUrl: repoData.homepageUrl || null,
      sourceUrl: repoData.url,
      primaryLanguage: repoData.primaryLanguage?.name || null,
      license: repoData.licenseInfo?.spdxId || repoData.licenseInfo?.name || null,
      ownerName: repoData.owner?.login,
      ownerAvatarUrl: repoData.owner?.avatarUrl || "",
      ownerType,
      topics,
      stars: repoData.stargazerCount || 0,
      forks: repoData.forkCount || 0,
      watchers: repoData.watchers?.totalCount || 0,
      openIssues: repoData.issues?.totalCount || 0,
      sourceCreatedAt: new Date(repoData.createdAt),
      sourceUpdatedAt: new Date(repoData.pushedAt || repoData.createdAt),
      location: repoData.owner?.location || null,
      email: repoData.owner?.email || null,
      blog: repoData.owner?.websiteUrl || null,
      company: repoData.owner?.company || null,
      readmeText,
      readmeSha,
    },
  };
}

/**
 * Searches repositories on GitHub using GraphQL Search API with cursor pagination.
 */
export async function searchGitHubRepos(
  queryString: string,
  first: number,
  after?: string | null
): Promise<GraphQLSearchResult> {
  const query = `
    query($queryString: String!, $first: Int!, $after: String) {
      search(query: $queryString, type: REPOSITORY, first: $first, after: $after) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          ... on Repository {
            name
            stargazerCount
            owner {
              login
            }
          }
        }
      }
    }
  `;

  const data = await runGraphQLQuery(query, { queryString, first, after });
  const searchData = data.search || {};
  const pageInfo = searchData.pageInfo || {};
  const nodes = (searchData.nodes || [])
    .filter((n: any) => n && n.owner && n.name)
    .map((n: any) => ({
      owner: n.owner.login,
      name: n.name,
      stars: n.stargazerCount || 0,
    }));

  return {
    endCursor: pageInfo.endCursor || null,
    hasNextPage: pageInfo.hasNextPage || false,
    nodes,
  };
}
