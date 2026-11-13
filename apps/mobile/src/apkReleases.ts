const repository = 'AndersonACP25/FlowSaldo';
const releasesUrl = `https://api.github.com/repos/${repository}/releases?per_page=30`;
const releasePath = `/${repository}/releases/tag/`;
const apkName = /^FlowSaldo-android-(\d+)\.apk$/;

export interface ApkUpdate {
  versionCode: number;
  label: string;
  releaseUrl: string;
}

export function selectApkUpdate(releases: unknown, installedCode: number): ApkUpdate | null {
  if (!Array.isArray(releases) || !Number.isSafeInteger(installedCode) || installedCode < 1) {
    return null;
  }

  let latest: ApkUpdate | null = null;
  for (const release of releases) {
    if (!release || release.draft !== false || !Array.isArray(release.assets)) continue;
    const tag = release.tag_name;
    if (typeof tag !== 'string' || !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) continue;

    for (const asset of release.assets) {
      if (!asset || asset.state !== 'uploaded' || typeof asset.name !== 'string') continue;
      const match = apkName.exec(asset.name);
      if (!match) continue;
      const versionCode = Number(match[1]);
      if (
        !Number.isSafeInteger(versionCode) ||
        versionCode <= (latest?.versionCode ?? installedCode)
      ) {
        continue;
      }
      latest = {
        versionCode,
        label: tag,
        releaseUrl: `https://github.com${releasePath}${encodeURIComponent(tag)}`,
      };
    }
  }
  return latest;
}

export async function fetchApkUpdate(installedCode: number, signal: AbortSignal) {
  const response = await fetch(releasesUrl, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });
  if (!response.ok) throw new Error(`GitHub Releases respondió con HTTP ${response.status}.`);
  return selectApkUpdate(await response.json(), installedCode);
}
