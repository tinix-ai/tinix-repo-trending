/* eslint-disable @typescript-eslint/no-explicit-any */
import { githubPool } from "./github-pool";
import { proxyManager } from "./proxy";

export interface GraphQLRepoResult {
  owner: string;
  name: string;
  exists: boolean;
  permissionDenied?: boolean;
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
  permissionDenied?: boolean;
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
): Promise<{ data: any; errors?: any[] }> {
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
          const remaining = response.headers.get("x-ratelimit-remaining");
          const isRateLimit = response.status === 429 || remaining === "0" || response.headers.has("retry-after");

          if (isRateLimit) {
            if (currentToken) {
              await githubPool.markTokenExhausted(currentToken, reset);
              console.log(`[GraphQL API] Rate limit hit (403/429). Rotated token. Retries left: ${maxRetries - 1}`);
              maxRetries--;
              continue;
            }
          } else {
            throw new Error(`GitHub API Permission Error (403): ${response.statusText}. Please verify token scopes or SSO permissions.`);
          }
        }
        throw new Error(`GitHub GraphQL API Error: ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as {
        errors?: Array<{ message: string; type?: string }>;
        data?: Record<string, any>;
      };
      
      if (body.errors) {
        const isRateLimit = body.errors.some((e: any) => e.type === 'RATE_LIMIT' || e.message.includes('rate limit'));
        
        if (isRateLimit) {
          if (currentToken) {
            await githubPool.markTokenExhausted(currentToken, reset);
            console.log(`[GraphQL API] Rate limit hit in response body. Rotated token. Retries left: ${maxRetries - 1}`);
            maxRetries--;
            continue; // Retry with new token
          } else {
            throw new Error("[RateLimitError] GitHub GraphQL API rate limit exceeded.");
          }
        }

        if (!body.data) {
          throw new Error(`GraphQL Errors: ${JSON.stringify(body.errors)}`);
        }
      }

      return { data: body.data || {}, errors: body.errors };
    } catch (err) {
      const errorStr = String(err);
      if (maxRetries === 1 && (errorStr.includes('RATE_LIMIT') || errorStr.includes('rate limit') || errorStr.includes('403') || errorStr.includes('429'))) {
        // If this is the last retry and it's a rate limit, throw with [RateLimitError] tag
        throw new Error(`[RateLimitError] GitHub API rate limit exhausted after retries. Last error: ${errorStr}`);
      }
      
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
 * Executes a batched GraphQL query to retrieve info for up to 50 GitHub repositories at once.
 */
export async function fetchGitHubBatch(
  repos: { owner: string; name: string }[]
): Promise<GraphQLRepoResult[]> {
  if (repos.length === 0) return [];
  if (repos.length > 50) {
    throw new Error("Batch size exceeds limit of 50 repositories");
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
  const { data, errors } = await runGraphQLQuery(query);

  const results: GraphQLRepoResult[] = repos.map((repo, index) => {
    const repoData = data[`repo_${index}`];

    // Check if there was an error associated with this specific repo
    const repoError = errors?.find((e: any) => 
      e.path?.includes(`repo_${index}`)
    );

    if (repoError) {
      const isNotFound = repoError.type === 'NOT_FOUND' || repoError.message?.toLowerCase().includes('could not resolve');
      const isPermission = repoError.type === 'FORBIDDEN' || repoError.message?.toLowerCase().includes('saml') || repoError.message?.toLowerCase().includes('permission');

      if (isPermission) {
        console.warn(`[GitHub GraphQL Batch] Permission/SSO error for ${repo.owner}/${repo.name}: ${repoError.message}`);
        return {
          owner: repo.owner,
          name: repo.name,
          exists: true,
          permissionDenied: true,
        };
      }

      if (isNotFound) {
        return {
          owner: repo.owner,
          name: repo.name,
          exists: false,
        };
      }

      console.warn(`[GitHub GraphQL Batch] Error for ${repo.owner}/${repo.name}: ${repoError.message} (Type: ${repoError.type})`);
      return {
        owner: repo.owner,
        name: repo.name,
        exists: true,
      };
    }

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

  const { data, errors } = await runGraphQLQuery(query, { owner, name });
  const repoData = data.repository;
  if (!repoData) {
    const permissionError = errors?.find((e: any) => 
      e.path?.includes('repository') && 
      (e.type === 'FORBIDDEN' || e.message?.toLowerCase().includes('saml') || e.message?.toLowerCase().includes('permission'))
    );
    if (permissionError) {
      console.warn(`[GitHub GraphQL] Permission/SSO error for ${owner}/${name}: ${permissionError.message}. Attempting anonymous REST fallback...`);
      const restResult = await fetchPublicRepoREST(owner, name);
      if (restResult.exists && restResult.data) {
        console.log(`[GitHub GraphQL] REST fallback succeeded for public repo ${owner}/${name}.`);
        return {
          exists: true,
          data: restResult.data,
        };
      }
      return {
        exists: true,
        permissionDenied: true,
      };
    }
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

  const { data } = await runGraphQLQuery(query, { queryString, first, after });
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

/**
 * Fallback to fetch public repository data via REST API without token.
 */
export async function fetchPublicRepoREST(
  owner: string,
  name: string
): Promise<{ exists: boolean; data?: any }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "TiniX-Repo-Trending",
      }
    });
    if (res.status === 404) {
      return { exists: false };
    }
    if (!res.ok) {
      console.warn(`[GitHub REST Fallback] HTTP error for ${owner}/${name}: ${res.status} ${res.statusText}`);
      return { exists: true };
    }
    const data = (await res.json()) as any;
    return {
      exists: true,
      data: {
        name: data.name,
        fullName: data.full_name,
        description: data.description || null,
        homepageUrl: data.homepage || null,
        sourceUrl: data.html_url,
        primaryLanguage: data.language || null,
        license: data.license?.spdx_id || data.license?.name || null,
        ownerName: data.owner?.login,
        ownerAvatarUrl: data.owner?.avatar_url || "",
        ownerType: data.owner?.type?.toLowerCase() === "organization" ? "org" : "user",
        topics: data.topics || [],
        stars: data.stargazers_count || 0,
        forks: data.forks_count || 0,
        watchers: data.watchers_count || 0,
        openIssues: data.open_issues_count || 0,
        sourceCreatedAt: new Date(data.created_at),
        sourceUpdatedAt: new Date(data.pushed_at || data.created_at),
        location: null,
        email: null,
        blog: null,
        company: null,
        readmeText: null,
        readmeSha: null,
      }
    };
  } catch (err) {
    console.warn(`[GitHub REST Fallback] Failed to fetch ${owner}/${name}:`, err);
    return { exists: true };
  }
}
