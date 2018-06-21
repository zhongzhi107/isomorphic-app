import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Helmet } from 'react-helmet';
import { fetchPosts } from './action';
import prefetch from '../../decorators/prefetch';
import DefaultLayout from '../../layouts/default';
import reducer from './reducer';

function mapStateToProps({ posts = [] }) {
  return { posts };
}

@prefetch('posts', reducer, dispatch => dispatch(fetchPosts()))
@connect(mapStateToProps, { fetchPosts })
export default class PostsListPage extends Component {
  static propTypes = {
    posts: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number.isRequired,
      title: PropTypes.string.isRequired
    }))
  };

  static defaultProps = {
    posts: []
  };

  renderPosts() {
    const { posts } = this.props;
    return posts.map(post => <li key={post.id}>{post.title}</li>);
  }

  render() {
    return (
      <DefaultLayout>
        <Helmet>
          <title>Posts</title>
        </Helmet>
        <h3>Protected list of posts</h3>
        <ul>{this.renderPosts()}</ul>
      </DefaultLayout>
    );
  }
}
