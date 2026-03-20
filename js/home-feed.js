document.addEventListener("DOMContentLoaded", async () => {
    // 1. Initialize Supabase correctly
    const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    const viewContainer = document.getElementById('viewModeContainer');
    const editContainer = document.getElementById('editModeContainer');
    const toggleBtn = document.getElementById('toggleEditBtn');
    const streamerGrid = document.getElementById('streamerGrid');
    const editList = document.getElementById('editStreamerList');
    const addBtn = document.getElementById('addStreamerBtn');
    const addInput = document.getElementById('newStreamerInput');
    const feedStatus = document.getElementById('feedStatus');

    let currentUser = null;
    let myFollows = [];
    let isEditing = false;

    // Check Auth using the initialized client
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        feedStatus.innerText = "Please log in.";
        return; 
    }
    
    currentUser = session.user;
    toggleBtn.style.display = 'block';
    await loadFollows();

    // Toggle Modes
    toggleBtn.addEventListener('click', () => {
        isEditing = !isEditing;
        if (isEditing) {
            viewContainer.style.display = 'none';
            editContainer.style.display = 'block';
            toggleBtn.innerText = "Done";
            renderEditList();
        } else {
            editContainer.style.display = 'none';
            viewContainer.style.display = 'block';
            toggleBtn.innerText = "Edit List";
            renderViewGrid();
        }
    });

    // Fetch from Supabase
    async function loadFollows() {
        const { data, error } = await supabase
            .from('ltg_streamers_followed')
            .select('id, sort_order, streamer_slug, ltg_streamers ( display_name )')
            .eq('user_id', currentUser.id)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error(error);
            return;
        }

        myFollows = data;
        feedStatus.innerText = `Tracking ${myFollows.length} streamers.`;
        if (!isEditing) renderViewGrid();
    }

    // Insert to Supabase
    addBtn.addEventListener('click', async () => {
        const slug = addInput.value.trim().toLowerCase();
        if (!slug) return;
        
        const newOrder = myFollows.length; 
        
        const { error } = await supabase
            .from('ltg_streamers_followed')
            .insert({ user_id: currentUser.id, streamer_slug: slug, sort_order: newOrder });

        if (error) {
            console.error(error);
        } else {
            addInput.value = '';
            await loadFollows();
            renderEditList();
        }
    });

    // Delete from Supabase
    window.removeFollow = async (id) => {
        const { error } = await supabase
            .from('ltg_streamers_followed')
            .delete()
            .eq('id', id);

        if (!error) {
            await loadFollows();
            renderEditList();
        }
    };

    // Render basic text nodes
    function renderViewGrid() {
        streamerGrid.innerHTML = '';
        if (myFollows.length === 0) {
            streamerGrid.innerHTML = '<p>No follows yet.</p>';
            return;
        }

        myFollows.forEach(follow => {
            const name = follow.ltg_streamers?.display_name || follow.streamer_slug;
            streamerGrid.innerHTML += `<div>${name} - Checking live status...</div>`;
        });
    }

    function renderEditList() {
        editList.innerHTML = '';
        myFollows.forEach(follow => {
            const name = follow.ltg_streamers?.display_name || follow.streamer_slug;
            editList.innerHTML += `
                <div>
                    <span>${name} (${follow.streamer_slug})</span>
                    <button onclick="removeFollow('${follow.id}')">Delete</button>
                </div>
            `;
        });
    }
});