import adapter from '@sveltejs/adapter-node';

const config = {
    kit: {
        adapter: adapter(),
        alias: {
            $lib: 'src/lib',
            $components: 'src/components'
        }
    }
};

export default config;
