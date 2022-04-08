const core = require('@actions/core');
const github = require('@actions/github');

const main = async () => {
	try {
		/**
		 * We need to fetch all the inputs that were provided to our action
		 * and store them in variables for us to use.
		 **/
		// const token = core.getInput('token', { required: true });
		const token = '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'

		/**
		 * Now we need to create an instance of Octokit which will use to call
		 * GitHub's REST API endpoints.
		 * We will pass the token as an argument to the constructor. This token
		 * will be used to authenticate our requests.
		 * You can find all the information about how to use Octokit here:
		 * https://octokit.github.io/rest.js/v18
		 **/
		const octokit = new github.getOctokit(token);

		const owner = github.context.repo.owner || core.getInput('owner');
		const repo = github.context.repo.repo || core.getInput('repo');
		const { data: { content } } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path: 'todos.xit'
		});

		// get all cards from default github project, if there's one
		const projects = await octokit.rest.projects.listForRepo({
			owner,
			repo
		});
		const project = projects.data.find(p => p.name === 'Default');
		const columns = await octokit.rest.projects.listColumns({
			project_id: project.id
		});
		
		console.log(project.id)
		const toDoColumn = columns.data.find(c => c.name === 'To do');
		const inProgressColumn = columns.data.find(c => c.name === 'In progress');
		const doneColumn = columns.data.find(c => c.name === 'Done');
		
		const toDoCards = await octokit.rest.projects.listCards({
			column_id: toDoColumn.id
		});
		const inProgressCards = await octokit.rest.projects.listCards({
			column_id: inProgressColumn.id
		});
		const doneCards = await octokit.rest.projects.listCards({
			column_id: doneColumn.id
		});
		const allCards = [...toDoCards.data, ...inProgressCards.data, ...doneCards.data];
		await Promise.all(allCards.map(card => {octokit.rest.projects.deleteCard({
			card_id: card.id
		})}))

		const parsed = Buffer.from(content, 'base64').toString('utf8');
		let promises = [];
		parsed.split('\n').forEach(line => {
			if (!line.startsWith('[')) {
				return;
			}
			const [key, value] = line.split('] ');
			const [, prefix] = key.split('[');
			let status;
			let column_id;
			switch (prefix) {
				case ' ':
					status = 'todo'
					column_id = toDoColumn.id
					break;
				case '@':
					status = 'in-progress'
					column_id = inProgressColumn.id
					break;
				case '~':
					status = 'obsolete'
					column_id = doneColumn.id
					break;
				case 'x':
					status = 'done'
					column_id = doneColumn.id
					break;
				default:
					status = 'todo'
					column_id = toDoColumn.id
					break;
			}
			promises.push(
				octokit.rest.projects.createCard({
				column_id,
				note: value
			})
			)
			core.setOutput(status, value);
		})
		await Promise.all(promises);

	} catch (error) {
		core.setFailed(error.message);
	}
}

// Call the main function to run the action
main();