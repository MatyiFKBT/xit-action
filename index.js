const core = require('@actions/core');
const github = require('@actions/github');

const main = async () => {
	try {
		/**
		 * We need to fetch all the inputs that were provided to our action
		 * and store them in variables for us to use.
		 **/
		const token = core.getInput('token', { required: true })
		// const token='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'

		/**
		 * Now we need to create an instance of Octokit which will use to call
		 * GitHub's REST API endpoints.
		 * We will pass the token as an argument to the constructor. This token
		 * will be used to authenticate our requests.
		 * You can find all the information about how to use Octokit here:
		 * https://octokit.github.io/rest.js/v18
		 **/
		const octokit = new github.getOctokit(token);

		const owner = github.context.repo.owner || core.getInput('user');
		const repo = github.context.repo.repo || core.getInput('repo');
		// const owner = 'matyifkbt';
		// const repo = 'xit-action';
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
		
		let toDoColumn;
		let inProgressColumn;
		let doneColumn;
		
		const project = projects.data.find(p => p.name === 'Default');
		core.setOutput('project', project);
		console.log({ project });

		if (!project) {
			console.warn(`No default project found. Creating one...`);	
			const { data: {id} } = await octokit.rest.projects.createForRepo({
				owner,
				repo,
				name: 'Default',
			});

			let todoResult = await octokit.rest.projects.createColumn({
				project_id: id,
				name: 'To do'
			});
			toDoColumn = todoResult.data

			let inProgressResult = await octokit.rest.projects.createColumn({
				project_id: id,
				name: 'In progress'
			})
			inProgressColumn = inProgressResult.data
			
			let doneResult = await octokit.rest.projects.createColumn({
				project_id: id,
				name: 'Done'
			})
			doneColumn = doneResult.data
		} else {
			const columns = await octokit.rest.projects.listColumns({
				project_id: project.id
			});

			console.log(columns)
			toDoColumn = columns.data.find(c => c.name === 'To do');
			inProgressColumn = columns.data.find(c => c.name === 'In progress');
			doneColumn = columns.data.find(c => c.name === 'Done');
		}
		console.log('if-en tul')

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
		console.log(allCards.length)
		await Promise.all(allCards.map(card => {
			octokit.rest.projects.deleteCard({
				card_id: card.id
			})
		}))

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