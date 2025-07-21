import adapter from '@sveltejs/adapter-node';

const config = {
    kit: {
        adapter: adapter(),
        alias: {
            $components: 'src/components'
        }
    }
};

export default config;
