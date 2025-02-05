import { useState, useEffect } from 'react';
import { Box, TextField, Typography, List, ListItem, ListItemText, IconButton, Drawer, AppBar, Toolbar, Divider, ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Send, Menu as MenuIcon } from '@mui/icons-material';
import axios from 'axios';

// Create dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#343541',
      paper: '#444654',
    },
    primary: {
      main: '#7B5CD1',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#D1D5DA',
    },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#202123',
          borderRight: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#343541',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#40414F',
            '&:hover': {
              backgroundColor: '#40414F',
            },
            '&.Mui-focused': {
              backgroundColor: '#40414F',
            },
          },
        },
      },
    },
  },
});

function App() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [todos, setTodos] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerWidth = 300;

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await axios.get('http://localhost:3000/todos');
      setTodos(response.data);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;

    setChatHistory(prev => [...prev, { type: 'user', content: message }]);

    try {
      const response = await axios.post('http://localhost:3000/chat', { message });
      setChatHistory(prev => [...prev, { type: 'bot', content: response.data.reply }]);
      fetchTodos();
    } catch (error) {
      console.error('Error sending message:', error);
      setChatHistory(prev => [...prev, { type: 'bot', content: 'Sorry, there was an error processing your request.' }]);
    }

    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box sx={{ width: drawerWidth, height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ color: 'text.primary' }}>
          Your Tasks
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List>
        {todos.map((todo) => (
          <ListItem
            key={todo.id}
            sx={{
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.05)',
              },
              borderRadius: 1,
              mb: 0.5,
              mx: 1,
            }}
          >
            <ListItemText 
              primary={todo.todo}
              sx={{ 
                wordBreak: 'break-word',
                '& .MuiTypography-root': {
                  fontSize: '0.9rem',
                  color: 'text.secondary',
                }
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div">
              AI Todo Assistant
            </Typography>
          </Toolbar>
        </AppBar>
        
        <Box
          component="nav"
          sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
          }}
        >
          <Toolbar />
          
          <Box sx={{ 
            flexGrow: 1, 
            overflow: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2,
            p: 2,
            mb: 2
          }}>
            {chatHistory.map((msg, index) => (
              <Box
                key={index}
                sx={{
                  alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.type === 'user' ? '#7B5CD1' : '#444654',
                  color: '#FFFFFF',
                  p: 2,
                  borderRadius: 2,
                  maxWidth: '80%',
                  wordBreak: 'break-word',
                  width: '100%',
                }}
              >
                <Typography>{msg.content}</Typography>
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              p: 2,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              bgcolor: 'background.default',
              position: 'fixed',
              bottom: 0,
              left: { xs: 0, sm: drawerWidth },
              right: 0,
              maxWidth: '800px',
              mx: 'auto',
              width: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                  height: '50px',
                  '& input': {
                    textAlign: 'center',
                  }
                },
              }}
              InputProps={{
                endAdornment: (
                  <IconButton 
                    onClick={handleSend} 
                    color="primary"
                    sx={{
                      position: 'absolute',
                      right: '8px',
                    }}
                  >
                    <Send />
                  </IconButton>
                ),
              }}
            />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
