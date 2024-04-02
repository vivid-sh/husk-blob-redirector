export default {
	async fetch(request) {
		// TODO cache using edge KV
		if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
			return new Response(null, {status: 405});
		}

		const re = new RegExp(`\/v2\/(.*)\/blobs\/(.*)`);

		const matches = request.url.match(re);

		if (!matches) {
			// TODO: provide a better error
			return new Response(null, {status: 404});
		}

		let image = matches[1];
		const blobSha = matches[2];

		// TODO: since you can only use non-namespaced images, this is sorta redundant ATM.
		if (!image.includes("/")) {
			image = `library/${image}`;
		}

		const authUrl = `https://auth.docker.io/token?scope=repository:${image}:pull&service=registry.docker.io`;

		const authResp = await fetch(authUrl);

		if (authResp.status !== 200) {
			return new Response(null, { status: authResp.status });
		}

		const accessToken = (await authResp.json())["token"]

		const redirectResp = await fetch(
			`https://registry-1.docker.io/v2/${image}/blobs/${blobSha}`,
			{
				method: "HEAD",
				headers: {
					"Accept-Encoding": "gzip",
					"Authorization": `Bearer ${accessToken}`,
					"Docker-Distribution-Api-Version": "registry/2.0",
					"Range": "bytes=0-1",
				},
			}
		);

		if (redirectResp.status !== 206) {
			console.error(`Expected redirect status to be 206, got ${redirectResp.status}`);

			return new Response("Could not redirect to Docker", { status: authResp.status });
		}

		return new Response(
			null,
			{
				status: 307,
				headers: new Headers({
					"Content-Length": "0",
					"Content-Type": "application/octet-stream",
					"Docker-Distribution-Api-Version": "registry/2.0",
					"Location": redirectResp.url,
					"Strict-Transport-Security": "max-age=31536000",
				}),
			}
		);
	},
};
