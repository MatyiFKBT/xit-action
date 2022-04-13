const core = require('@actions/core');
const github = require('@actions/github');

const main = async () => {
	try {
		const token = core.getInput('token', { required: true })
		/**
		 * https://octokit.github.io/rest.js/v18
		 **/
		const octokit = new github.getOctokit(token);

		const owner = core.getInput('user') || github.context.repo.owner;
		const repo = core.getInput('repo') || github.context.repo.repo ;
		const path = core.getInput('path') || 'todos.xit'
		const { data: { content } } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path
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
		
		if (!project) {
			core.warning(`No default project found. Creating one...`);	
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

			toDoColumn = columns.data.find(c => c.name === 'To do');
			inProgressColumn = columns.data.find(c => c.name === 'In progress');
			doneColumn = columns.data.find(c => c.name === 'Done');
		}

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